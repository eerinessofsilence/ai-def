import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useBlocker } from "react-router-dom";
import { api, APIError, statuses } from "./api";
import { collectionNames } from "./content-types";
import { ErrorMessage, Loading, Modal } from "./ui";
import { useSession } from "./session";

type Item = { id: number; name: string; status: "draft" | "published" };
type Snapshot = { version: string; items: Item[] };

export default function WebsiteOrder({ site, kind, onClose }: { site: string; kind: string; onClose: (applied?: boolean) => void }) {
  const [original, setOriginal] = useState<Snapshot | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirm, setConfirm] = useState<"cancel" | "reload" | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const leave = useRef(false);
  const { beforeSignOut, session } = useSession();
  const dirty = original !== null && items.some((item, index) => item.id !== original.items[index]?.id);
  const blocker = useBlocker(() => !leave.current && (dirty || busy));
  const url = `${site}/${kind}/reorder/`;
  useEffect(() => { document.getElementById("cms-order-title")?.focus(); }, [attempt]);
  useEffect(() => {
    const abort = new AbortController(); setOriginal(null); setItems([]); setError(""); setConflict(false); setAnnouncement("");
    void api<Snapshot>(url, { signal: abort.signal }).then((value) => { if (!abort.signal.aborted) { setOriginal(value); setItems(value.items); } }).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load catalogue order."); });
    return () => abort.abort();
  }, [url, attempt]);
  useEffect(() => beforeSignOut(async () => { if (dirty || busy) throw new Error("Apply or cancel the proposed website order before signing out."); }), [beforeSignOut, dirty, busy]);
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  function move(index: number, direction: number) {
    const next = [...items];
    const target = index + direction;
    if (!next[index] || !next[target]) return;
    const moved = next[index];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next); setAnnouncement(`${moved.name} moved to position ${target + 1} of ${next.length}.`);
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-order-id="${moved.id}"]`);
      const button = row?.querySelector<HTMLButtonElement>(`button[data-direction="${direction}"]:not(:disabled)`) || row?.querySelector<HTMLButtonElement>("button:not(:disabled)");
      (button || row)?.focus({ preventScroll: true }); row?.scrollIntoView({ block: "nearest" });
    });
  }
  async function apply() {
    if (!original) return;
    setBusy(true); setError("");
    try {
      await api<Snapshot>(url, { method: "POST", body: JSON.stringify({ version: original.version, ids: items.map((item) => item.id) }) });
      leave.current = true; onClose(true);
    } catch (failure) {
      setConflict(failure instanceof APIError && failure.status === 409);
      setError(failure instanceof Error ? failure.message : "Unable to apply order. Your proposal remains below.");
    } finally { setBusy(false); }
  }
  function cancel() { if (dirty) setConfirm("cancel"); else { leave.current = true; onClose(); } }
  return <section className="cms-page"><header className="cms-page-heading"><div><h1 id="cms-order-title" tabIndex={-1}>Website order</h1><p className="cms-muted">{site === "arms" ? "ARMS" : "AI DEF"} · {collectionNames[kind]} · All saved catalogue items</p></div></header>
    <div className="cms-order-toolbar"><p role="status">{busy ? "Applying order…" : dirty ? "Proposed order · not applied" : "Current website order"}</p><div className="cms-row-actions"><button type="button" className="cms-button" disabled={busy} onClick={cancel}>{dirty ? "Cancel" : "Back to list"}</button><button type="button" className="cms-button cms-primary" disabled={busy || !dirty || conflict} onClick={() => { void apply(); }}>{busy ? "Applying…" : session?.environment === "local" ? "Apply to local copy" : "Apply order"}</button></div></div>
    <p className="cms-notice">Arrange items, then apply once. The website stays unchanged until you apply. Filters are temporarily removed; your previous list will return afterwards. Unpublished items keep their position for later publication. New drafts join after their first publication.</p>
    {error && <ErrorMessage message={error} retry={!original ? () => setAttempt((value) => value + 1) : undefined} />}
    {conflict && <p className="cms-notice">Your proposal is still shown. <button type="button" className="cms-button" onClick={() => setConfirm("reload")}>Load latest order</button></p>}
    {!original && !error && <Loading label="Loading the full catalogue order…" />}
    <p className="cms-sr" role="status" aria-live="polite">{announcement}</p>
    {original && <ol className="cms-order-list">{items.map((item, index) => <li key={item.id} data-order-id={item.id} tabIndex={-1}><span className="cms-order-position" aria-hidden="true">{index + 1}</span><div className="cms-order-name"><strong>{item.name}</strong><span className={`cms-status cms-status-${item.status}`}>{statuses[item.status]}</span></div><div className="cms-row-actions"><button type="button" className="cms-icon" data-direction="-1" aria-label={`${item.name}: move up`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp /></button><button type="button" className="cms-icon" data-direction="1" aria-label={`${item.name}: move down`} disabled={busy || index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown /></button></div></li>)}{!items.length && <li><p className="cms-muted">No saved catalogue items yet. Publish a new draft to give it a catalogue position.</p></li>}</ol>}
    <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "reload" ? "Replace your proposed order?" : "Discard proposed order?"} description={confirm === "reload" ? "The latest catalogue order will replace the proposal shown here. No order will be applied." : "The website order will stay unchanged. Your previous filters will return."}><footer><button type="button" className="cms-button" onClick={() => setConfirm(null)}>Keep arranging</button><button type="button" className="cms-button cms-danger" onClick={() => { if (confirm === "reload") { setConfirm(null); setAttempt((value) => value + 1); } else { leave.current = true; onClose(); } }}>{confirm === "reload" ? "Replace proposal" : "Discard proposal"}</button></footer></Modal>
    <Modal open={blocker.state === "blocked"} preventDismiss={busy} onClose={() => { if (blocker.state === "blocked") blocker.reset(); }} title={busy ? "Applying website order" : "Unapplied website order"} description={busy ? "Wait for the result before leaving this page." : "Your proposed order has not been applied. Stay to apply it, or discard the proposal and leave."}><footer><button type="button" className="cms-button cms-primary" disabled={busy} onClick={() => { if (blocker.state === "blocked") blocker.reset(); }}>Stay</button><button type="button" className="cms-button cms-danger" disabled={busy} onClick={() => { if (blocker.state === "blocked") { leave.current = true; blocker.proceed(); } }}>Discard and leave</button></footer></Modal>
  </section>;
}
