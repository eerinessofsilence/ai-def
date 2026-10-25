import { useEffect, useRef, useState } from "react";
import { Check, FileText, Film, Search, UploadCloud } from "lucide-react";
import { useBlocker, useParams, useSearchParams } from "react-router-dom";
import Select from "../../components/ui/select";
import { api, dateTime } from "./api";
import type { AssetList, MediaAsset, MediaKind } from "./api";
import CMSImage from "./CMSImage";
import AssetDetails from "./AssetDetails";
import { fileKind, fileSize, mediaAccept, mediaHelp, mediaNames, uploadError } from "./media";
import { EmptyState, ErrorMessage, Loading, Modal, Pagination } from "./ui";
import { useSession } from "./session";

type Job = { id: string; file: File; state: "queued" | "uploading" | "ready" | "error"; error: string };
type BrowserProps = {
  site: string; kind?: MediaKind; selected?: MediaAsset[];
  onSelect?: (asset: MediaAsset) => void; onBusyChange?: (busy: boolean) => void;
  trackUpload?: (task: Promise<void>) => void;
  params?: URLSearchParams; onParamsChange?: (params: URLSearchParams) => void;
  multiple?: boolean;
  onUnsavedChange?: (unsaved: boolean) => void;
};

export function MediaBrowser({ site, kind, selected = [], onSelect, onBusyChange, onUnsavedChange, trackUpload, params: externalParams, onParamsChange, multiple = true }: BrowserProps) {
  const [localParams, setLocalParams] = useState(new URLSearchParams());
  const params = externalParams || localParams;
  const setParams = onParamsChange || setLocalParams;
  const query = params.toString();
  const [search, setSearch] = useState(params.get("q") || "");
  const [result, setResult] = useState<AssetList | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [tab, setTab] = useState<"files" | "upload">("files");
  const [detail, setDetail] = useState<MediaAsset | null>(null);
  const inFlight = useRef(new Set<string>());
  const busy = jobs.some((job) => job.state === "queued" || job.state === "uploading");
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => { setSearch(new URLSearchParams(query).get("q") || ""); }, [query]);
  useEffect(() => {
    const abort = new AbortController();
    const requestParams = new URLSearchParams(query);
    if (kind) requestParams.set("kind", kind);
    setResult(null); setError("");
    void api<AssetList>(`${site}/assets/?${requestParams}`, { signal: abort.signal }).then((response) => {
      if (!abort.signal.aborted) setResult(response);
    }).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load files."); });
    return () => abort.abort();
  }, [site, query, kind, attempt]);

  function filter(key: string, value: string) {
    const next = new URLSearchParams(params); next.delete("page");
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  }
  function closeDetail() {
    const identifier = detail?.ref.asset_id;
    setDetail(null);
    requestAnimationFrame(() => (document.querySelector<HTMLButtonElement>(`button[data-asset-id="${identifier}"]`) || document.querySelector<HTMLInputElement>('input[aria-label="Search files"]'))?.focus({ preventScroll: true }));
  }
  async function upload(job: Job) {
    if (inFlight.current.has(job.id)) return;
    const problem = uploadError(job.file, kind);
    if (problem) { setJobs((previous) => previous.map((row) => row.id === job.id ? { ...row, state: "error", error: problem } : row)); return; }
    inFlight.current.add(job.id);
    setJobs((previous) => previous.map((row) => row.id === job.id ? { ...row, state: "uploading", error: "" } : row));
    try {
      const form = new FormData(); form.append("file", job.file); form.append("kind", fileKind(job.file.name)!);
      const response = await api<{ ref: { asset_id: string }; url: string; width: number | null; height: number | null }>(`${site}/uploads/`, { method: "POST", body: form });
      const asset: MediaAsset = { ...response, name: job.file.name, kind: fileKind(job.file.name)!, size_bytes: null, created_at: "" };
      onSelect?.(asset);
      setJobs((previous) => previous.map((row) => row.id === job.id ? { ...row, state: "ready" } : row));
      setAttempt((previous) => previous + 1);
    } catch (failure) {
      setJobs((previous) => previous.map((row) => row.id === job.id ? { ...row, state: "error", error: failure instanceof Error ? failure.message : "Unable to upload the file." } : row));
    } finally { inFlight.current.delete(job.id); }
  }
  function enqueue(files: FileList | null) {
    if (!files?.length) return;
    const added: Job[] = Array.from(files).map((file) => ({ id: crypto.randomUUID(), file, state: "queued", error: "" }));
    if (!multiple && added.length > 1) {
      setJobs((previous) => [...previous, ...added.map((job): Job => ({ ...job, state: "error", error: "Choose one file at a time for this field." }))]);
      setTab("upload");
      return;
    }
    setJobs((previous) => [...previous, ...added]); setTab("upload");
    const task = (async () => { for (const job of added) await upload(job); })();
    trackUpload?.(task);
  }
  const uploadControl = <label className="cms-button cms-primary cms-file"><UploadCloud aria-hidden="true" />{multiple ? "Upload files" : "Upload file"}<input type="file" multiple={multiple} accept={kind ? mediaAccept[kind] : Object.values(mediaAccept).join(",")} onChange={(event) => { enqueue(event.target.files); event.target.value = ""; }} /></label>;

  return <div className="cms-media-browser" onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDrop={(event) => { if (!event.dataTransfer.files.length) return; event.preventDefault(); enqueue(event.dataTransfer.files); }}>
    <div className="cms-media-tabs">{jobs.length > 0 && <div className="cms-row-actions"><button type="button" className="cms-button" aria-pressed={tab === "files"} onClick={() => setTab("files")}>Files</button><button type="button" className="cms-button" aria-pressed={tab === "upload"} onClick={() => setTab("upload")}>Uploads · {jobs.length}</button></div>}<div className="cms-row-actions"><span className="cms-muted">Drop files here or</span>{uploadControl}</div></div>
    {tab === "files" ? <>
      <div className="cms-list-tools"><form className="cms-search" role="search" onSubmit={(event) => { event.preventDefault(); filter("q", search.trim()); }}><Search aria-hidden="true" /><input type="search" aria-label="Search files" placeholder="File or material name…" value={search} onChange={(event) => { setSearch(event.target.value); if (!event.target.value) filter("q", ""); }} /><button type="submit">Search</button></form>{!kind && <Select aria-label="File type" value={params.get("kind") || ""} onValueChange={(value) => filter("kind", value)}><option value="">All types</option>{Object.entries(mediaNames).filter(([key]) => key !== "unknown").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>}</div>
      {(params.get("q") || params.get("kind")) && <div className="cms-filter-summary"><span>Filters applied</span><button type="button" onClick={() => setParams(new URLSearchParams())}>Clear filters</button></div>}
      {error && <ErrorMessage message={error} retry={() => setAttempt((previous) => previous + 1)} />}
      {!result && !error && <Loading label="Loading media library…" />}
      {result && <><div className="cms-media-grid">{result.items.map((asset) => {
        const selectedIndex = selected.findIndex((item) => item.ref.asset_id === asset.ref.asset_id);
        const active = selectedIndex >= 0;
        return <button type="button" key={asset.ref.asset_id} data-asset-id={asset.ref.asset_id} className={`cms-media-card${active ? " is-selected" : ""}`} aria-pressed={onSelect ? active : undefined} onClick={() => onSelect ? onSelect(asset) : setDetail(asset)}>
          <span className="cms-media-card-preview">{asset.kind === "image" && asset.url ? <CMSImage src={asset.url} /> : <span className="cms-media-type">{asset.kind === "video" ? <Film /> : <FileText />}<span>{mediaNames[asset.kind]}</span><small>No thumbnail</small></span>}{active && <span className="cms-media-selected">{multiple ? selectedIndex + 1 : <Check aria-hidden="true" />}<span className="cms-sr">Selected{multiple ? ` · position ${selectedIndex + 1}` : ""}</span></span>}</span>
          <span className="cms-media-card-info"><strong title={asset.name}>{asset.name}</strong><small>{mediaNames[asset.kind]}{asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ""}</small><small>{asset.created_at ? dateTime(asset.created_at) : "Date unknown"} · {fileSize(asset.size_bytes)}</small>{asset.usage_count !== undefined && <small title={asset.materials?.join(", ")}>{asset.usage_count ? `Used in ${asset.usage_count} ${asset.usage_count === 1 ? "material" : "materials"}` : "No current usage"}</small>}</span>
        </button>;
      })}</div>{!result.items.length && <EmptyState title={params.get("q") || params.get("kind") ? "No files found" : "Media library is empty"} description="Files uploaded through CMS for this site appear here. Legacy files remain available within their content." />}
      <Pagination {...result} onPage={(page) => { const next = new URLSearchParams(params); next.set("page", String(page)); setParams(next); }} /></>}
    </> : <>
      <p className="cms-muted">{kind ? mediaHelp[kind] : Object.values(mediaHelp).join(" ")}</p>
      <p className="cms-notice">Uploaded files remain in the library even if insertion is cancelled. Images are processed by the server and saved as WebP.</p>
      {jobs.length > 0 && <p className="cms-muted" role="status">{jobs.filter((job) => job.state === "ready").length}/{jobs.length} files uploaded{jobs.some((job) => job.state === "error") ? " · check the errors below" : ""}.</p>}<div className="cms-upload-queue" aria-live="polite">{jobs.map((job) => <div key={job.id}><div><strong>{job.file.name}</strong><small>{fileSize(job.file.size)} · {{ queued: "Queued", uploading: "Uploading…", ready: "Done", error: "Error" }[job.state]}</small>{job.error && <p className="cms-field-error">{job.error}</p>}</div>{job.state === "ready" && <Check aria-label="Uploaded" />}{job.state === "error" && <button type="button" className="cms-button" onClick={() => { const task = upload(job); trackUpload?.(task); }}>Retry</button>}</div>)}</div>
    </>}
    {detail && <AssetDetails key={detail.ref.asset_id} site={site} asset={detail} onUnsavedChange={onUnsavedChange} onClose={closeDetail} onSaved={(asset) => { setDetail(asset); setAttempt((value) => value + 1); }} />}
  </div>;
}

export default function MediaLibrary() {
  const { site = "ai-def" } = useParams();
  const [params, setParams] = useSearchParams();
  const { beforeSignOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [unsavedName, setUnsavedName] = useState(false);
  const blocker = useBlocker(busy || unsavedName);
  useEffect(() => beforeSignOut(async () => { if (busy || unsavedName) throw new Error("Wait for uploads and save or discard the file name before signing out."); }), [beforeSignOut, busy, unsavedName]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  return <section className="cms-page"><header className="cms-page-heading"><div><h1>Media library</h1><p className="cms-muted">Files {site === "arms" ? "arms.ai-def.com" : "ai-def.com"} · uploaded through CMS</p></div></header><MediaBrowser key={site} site={site} params={params} onParamsChange={setParams} onBusyChange={setBusy} onUnsavedChange={setUnsavedName} /><Modal open={blocker.state === "blocked"} onClose={() => { if (blocker.state === "blocked") blocker.reset(); }} title={unsavedName ? "Unsaved file name" : "Upload in progress"} description={unsavedName ? "Save the library name before leaving, or explicitly discard your changes." : "Stay to see the result. Files already uploaded remain in the library if you leave."}><footer><button type="button" className="cms-button cms-primary" onClick={() => { if (blocker.state === "blocked") blocker.reset(); }}>Stay</button><button type="button" className="cms-button" onClick={() => { if (blocker.state === "blocked") blocker.proceed(); }}>Leave page</button></footer></Modal></section>;
}
