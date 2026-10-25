import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { api } from "./api";
import type { AssetDetails as Details, AssetUsage, MediaAsset } from "./api";
import CMSImage from "./CMSImage";
import { fileSize, mediaNames } from "./media";
import { ErrorMessage, Loading, Modal } from "./ui";
import { collectionNames } from "./content-types";

export default function AssetDetails({ site, asset, onClose, onSaved, onUnsavedChange }: { site: string; asset: MediaAsset; onClose: () => void; onSaved: (asset: MediaAsset) => void; onUnsavedChange?: (unsaved: boolean) => void }) {
  const [detail, setDetail] = useState<Details | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false);
  const dirty = detail !== null && name !== (detail.display_name || "");
  useEffect(() => { onUnsavedChange?.(dirty || busy); return () => onUnsavedChange?.(false); }, [dirty, busy, onUnsavedChange]);
  const close = () => dirty ? setConfirmClose(true) : onClose();
  useEffect(() => {
    const abort = new AbortController(); setDetail(null); setError("");
    void api<Details>(`${site}/assets/${asset.ref.asset_id}/`, { signal: abort.signal }).then((result) => { if (!abort.signal.aborted) { setDetail(result); setName(result.display_name || ""); } }).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load file details."); });
    return () => abort.abort();
  }, [site, asset.ref.asset_id, attempt]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const links = (items: AssetUsage[]) => <ul className="cms-asset-usages">{items.map((usage) => <li key={`${usage.identity}:${usage.state}:${usage.version}`}><Link to={`/${site}/${usage.kind}/${usage.id}`} onClick={(event) => { if (dirty || busy) { event.preventDefault(); setError("Save or discard the file name before opening a material."); } else onClose(); }}>{usage.name}</Link><small>{collectionNames[usage.kind] || usage.kind} · {usage.state === "history" ? `History · version ${usage.version}` : usage.state === "stored" ? "Shared module" : usage.state === "published" ? "Published material" : usage.state === "draft" ? "Draft" : "Unpublished material"}{usage.locations.length ? ` · ${usage.locations.join(", ")}` : ""}</small></li>)}</ul>;
  return <Modal open onClose={close} preventDismiss={busy} className="cms-asset-modal" title={detail?.name || asset.name} description="File for this site. Image descriptions are managed in each material."><div className="cms-asset-body">
    {error && <ErrorMessage message={error} retry={!detail ? () => setAttempt((value) => value + 1) : undefined} />}
    {!detail && !error && <Loading label="Finding file usage…" />}
    {detail && <><div className="cms-asset-detail">{detail.kind === "image" ? <CMSImage src={detail.url} /> : detail.kind === "video" ? <video src={detail.url} controls preload="metadata" /> : <FileText aria-hidden="true" />}</div><p className="cms-muted">{mediaNames[detail.kind]} · {fileSize(detail.size_bytes)}{detail.width && detail.height ? ` · ${detail.width} × ${detail.height}` : ""}</p>
      <form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(""); setSaved(false); void api<Details>(`${site}/assets/${asset.ref.asset_id}/`, { method: "PATCH", body: JSON.stringify({ version: detail.version, display_name: name }) }).then((result) => { setDetail(result); setName(result.display_name || ""); setSaved(true); onSaved(result); }).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : "Unable to save the file name.")).finally(() => setBusy(false)); }}><label className="cms-field"><span>Library name</span><input value={name} maxLength={255} placeholder={detail.original_name} disabled={busy} onChange={(event) => { setName(event.target.value); setSaved(false); setConfirmClose(false); }} /><small>Original file: {detail.original_name}. Renaming does not replace the file or change image descriptions. Leave blank to use the original name.</small></label><button className="cms-button" disabled={busy || !dirty}>{busy ? "Saving…" : "Save name"}</button>{saved && <p role="status" className="cms-success">File name saved.</p>}</form>
      <section className="cms-asset-usage-section"><h3>Used in {detail.usage_count} {detail.usage_count === 1 ? "material" : "materials"}</h3>{detail.usages.some((usage) => usage.state !== "history") ? links(detail.usages.filter((usage) => usage.state !== "history")) : <p className="cms-muted">No current material uses this file.</p>}</section>
      {detail.usages.some((usage) => usage.state === "history") && <details className="cms-details"><summary>Retained in version history</summary><p className="cms-muted">These versions reference the file. Links open the current material; select the listed version in its history.</p>{links(detail.usages.filter((usage) => usage.state === "history"))}</details>}
    </>}
    {confirmClose && <div className="cms-notice" role="alert"><p>The library name has unsaved changes.</p><div className="cms-row-actions"><button type="button" className="cms-button" onClick={() => setConfirmClose(false)}>Keep editing</button><button type="button" className="cms-button cms-danger" onClick={onClose}>Discard name and close</button></div></div>}
    </div><footer><button type="button" className="cms-button" disabled={busy} onClick={close}>Close</button><a className="cms-button" href={asset.url} target="_blank" rel="noreferrer">Open file</a></footer>
  </Modal>;
}
