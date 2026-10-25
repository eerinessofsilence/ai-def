import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { api, APIError, SESSION_RESTORED_EVENT } from "./api";
import type { ArmsData, CMSDocument } from "./api";
import { useSession } from "./session";

export function useDocument<T = ArmsData>(site: string, id: string, kind = "products") {
  const { beforeSignOut } = useSession();
  const [document, setDocument] = useState<CMSDocument<T> | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [media, setMedia] = useState<Record<string, string>>({});
  const [state, setState] = useState<"loading" | "saved" | "dirty" | "saving" | "error">("loading");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const fieldErrors = useRef<Record<string, string>>({});
  const current = useRef<T | null>(null);
  const saved = useRef("");
  const record = useRef<CMSDocument<T> | null>(null);
  const pending = useRef<Promise<CMSDocument<T>> | null>(null);
  const uploads = useRef(new Set<Promise<void>>());
  const [uploading, setUploading] = useState(0);
  const mounted = useRef(true);
  const [attempt, setAttempt] = useState(0);
  const url = `${site}/documents/`;

  const report = useCallback((failure: unknown) => {
    if (!mounted.current) return;
    setError(failure instanceof Error ? failure.message : "Unable to save. Your changes remain in the form.");
    if (failure instanceof APIError && Object.keys(failure.fields).length) fieldErrors.current = failure.fields;
    setFields(fieldErrors.current);
    setConflict(failure instanceof APIError && failure.status === 409);
    setState(current.current !== null && JSON.stringify(current.current) === saved.current ? "saved" : "error");
  }, []);

  const replace = useCallback((value: CMSDocument<T>) => {
    record.current = value; current.current = value.data; saved.current = JSON.stringify(value.data);
    if (!mounted.current) return;
    setDocument(value); setData(value.data); setMedia((previous) => ({ ...previous, ...value.media }));
    fieldErrors.current = {};
    setState("saved"); setError(""); setFields({}); setConflict(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    setState("loading");
    const request = id.startsWith("live-")
      ? api<CMSDocument<T>>(`${site}/${kind}/`, { method: "POST", body: JSON.stringify({ target_id: Number(id.slice(5)) }), signal: abort.signal })
      : api<CMSDocument<T>>(url + id + "/", { signal: abort.signal });
    void request.then(replace).catch((failure: unknown) => { if (!abort.signal.aborted) report(failure); });
    return () => { mounted.current = false; abort.abort(); };
  }, [site, id, kind, url, attempt, replace, report]);

  function change(update: (previous: T) => T) {
    if (!current.current) return;
    const previous = current.current;
    current.current = update(previous);
    const valueAt = (value: unknown, path: string) => path.split(".").reduce<unknown>((node, key) => node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined, value);
    fieldErrors.current = Object.fromEntries(Object.entries(fieldErrors.current).filter(([path]) => JSON.stringify(valueAt(previous, path)) === JSON.stringify(valueAt(current.current, path))));
    setData(current.current);
    setState(JSON.stringify(current.current) === saved.current ? "saved" : "dirty");
    setFields(fieldErrors.current);
    if (!conflict && !Object.keys(fieldErrors.current).length) setError("");
  }

  const flush = useCallback((): Promise<CMSDocument<T>> => {
    if (pending.current) return pending.current;
    if (!record.current || !current.current) return Promise.reject(new Error("The content has not loaded yet."));
    pending.current = (async () => {
      await Promise.all(uploads.current);
      while (current.current && JSON.stringify(current.current) !== saved.current) {
        if (mounted.current) setState("saving");
        const outgoing = JSON.stringify(current.current);
        const result = await api<CMSDocument<T>>(url + record.current!.id + "/", { method: "PUT", body: JSON.stringify({ version: record.current!.version, data: JSON.parse(outgoing) }) });
        record.current = result;
        saved.current = outgoing;
        if (mounted.current) {
          setDocument(result); setMedia((previous) => ({ ...previous, ...result.media }));
        }
      }
      if (mounted.current) {
        setState("saved");
        if (!Object.keys(fieldErrors.current).length) setError("");
        setConflict(false);
      }
      return record.current!;
    })().catch((failure: unknown) => { report(failure); throw failure; }).finally(() => { pending.current = null; });
    return pending.current;
  }, [url, report]);

  useEffect(() => beforeSignOut(() => current.current && record.current ? flush() : Promise.resolve()), [beforeSignOut, flush]);

  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (current.current && record.current && !conflict) void flush().catch(() => undefined);
    };
    window.addEventListener("keydown", save);
    return () => window.removeEventListener("keydown", save);
  }, [flush, conflict]);

  useEffect(() => {
    const resume = () => { if (!conflict && current.current && JSON.stringify(current.current) !== saved.current) void flush().catch(() => undefined); };
    window.addEventListener(SESSION_RESTORED_EVENT, resume);
    return () => window.removeEventListener(SESSION_RESTORED_EVENT, resume);
  }, [conflict, flush]);

  useEffect(() => {
    if (state !== "dirty" || conflict) return;
    const timer = window.setTimeout(() => { void flush().catch(() => undefined); }, 1200);
    return () => window.clearTimeout(timer);
  }, [data, state, conflict, flush]);

  const unsaved = uploading > 0 || (data !== null && JSON.stringify(data) !== saved.current);
  const blocker = useBlocker(() => uploads.current.size > 0 || (current.current !== null && JSON.stringify(current.current) !== saved.current));
  useEffect(() => {
    if (blocker.state === "blocked") void flush().then(() => blocker.proceed()).catch(() => undefined);
  }, [blocker, flush]);
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  return { document, data, media, state, error, fields, conflict, unsaved, blocker, change, flush, replace, report,
    reload: () => setAttempt((value) => value + 1),
    uploading,
    trackUpload: (task: Promise<void>) => {
      uploads.current.add(task); setUploading(uploads.current.size);
      void task.finally(() => { uploads.current.delete(task); if (mounted.current) setUploading(uploads.current.size); }).catch(() => undefined);
    },
    addMedia: (key: string, value: string) => setMedia((previous) => ({ ...previous, [key]: value })) };
}
