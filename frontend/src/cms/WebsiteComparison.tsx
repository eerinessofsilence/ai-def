import { useEffect, useState } from "react";
import { api, APIError, languages } from "./api";
import type { CMSDocument } from "./api";
import { changeLanguage, contentChanges, readablePath } from "./changes";
import ChangeList from "./ChangeList";
import type { ReferenceLabels } from "./ChangeList";
import Select from "../../components/ui/select";
import { ErrorMessage, Loading, Modal } from "./ui";

type Comparison = { version: number; live_version: string; changed: boolean; published: boolean; before: unknown; after: unknown; media: Record<string, string>; reference_labels: ReferenceLabels };

export default function WebsiteComparison<T>({ site, prepare, onResolved, onClose, label = readablePath }: {
  site: string; prepare: () => Promise<CMSDocument<T>>; onResolved: (value: CMSDocument<T>) => void; onClose: () => void; label?: (path: string) => string;
}) {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [language, setLanguage] = useState("all");
  useEffect(() => {
    const abort = new AbortController(); setComparison(null); setError(""); setStale(false);
    void prepare().then((document) => api<Comparison>(`${site}/documents/${document.id}/website/`, { method: "POST", body: JSON.stringify({ version: document.version }), signal: abort.signal })).then((value) => { if (!abort.signal.aborted) setComparison(value); }).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to compare versions."); });
    return () => abort.abort();
  }, [site, prepare, attempt]);
  async function loadWebsite() {
    if (!comparison) return;
    setBusy(true); setError("");
    try {
      const document = await prepare();
      if (document.version !== comparison.version) throw new APIError("The draft changed. Compare again before loading the website version.", 409);
      const result = await api<CMSDocument<T>>(`${site}/documents/${document.id}/refresh/`, { method: "POST", body: JSON.stringify({ version: comparison.version, live_version: comparison.live_version, preserve_draft: true }) });
      onResolved(result); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to load the website version."); setStale(true); }
    finally { setBusy(false); }
  }
  const changes = comparison ? contentChanges(comparison.before, comparison.after) : [];
  const shown = changes.filter((change) => language === "all" || (changeLanguage(change.path) || "shared") === language);
  return <Modal open onClose={onClose} preventDismiss={busy} className="cms-review-modal" title="Compare with website" description="Keep both versions before continuing."><div className="cms-review-body">
    <p className="cms-notice">Loading the website version saves your complete draft as a separate history entry first. It does not publish or change the website. You can compare and restore the saved draft from Version history.</p>
    {error && <ErrorMessage message={error} retry={() => setAttempt((value) => value + 1)} />}
    {!comparison && !error && <Loading label="Saving draft and comparing versions…" />}
    {comparison && <><h3>{comparison.changed ? "Website changed outside this draft" : "Website version is up to date"}</h3><p className="cms-muted">{comparison.published ? "Current website content is labelled On website below." : "This material is currently unpublished on the website. Its stored content is labelled On website below."} Your saved work is labelled Your CMS draft. Reference names reflect current entries.</p><label className="cms-field"><span>Filter differences</span><Select aria-label="Filter website differences" value={language} onValueChange={setLanguage}><option value="all">All languages and shared fields</option><option value="shared">Shared fields</option>{languages.filter(([code]) => site === "arms" || code !== "ru").map(([code, name]) => <option key={code} value={code}>{name}</option>)}</Select></label><ChangeList changes={shown} before={comparison.before} after={comparison.after} media={comparison.media} references={comparison.reference_labels} label={label} beforeTitle="On website" afterTitle="Your CMS draft" />{!shown.length && <p className="cms-muted">No differences match this filter.</p>}</>}
  </div><footer><button className="cms-button" disabled={busy} onClick={onClose}>Keep editing my draft</button><button className="cms-button cms-primary" disabled={busy || stale || !comparison?.changed} onClick={() => { void loadWebsite(); }}>{busy ? "Preserving draft…" : "Save draft in history and load website"}</button></footer></Modal>;
}
