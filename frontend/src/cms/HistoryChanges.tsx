import { useEffect, useState } from "react";
import Select from "../../components/ui/select";
import { api, languages } from "./api";
import type { CMSDocument } from "./api";
import ChangeList from "./ChangeList";
import type { ReferenceLabels } from "./ChangeList";
import { changeLanguage, contentChanges, readablePath } from "./changes";
import { ErrorMessage, Loading, RestoreButton } from "./ui";

type Comparison = { version: number; revision: number; before: unknown; after: unknown; media: Record<string, string>; reference_labels: ReferenceLabels };

export default function HistoryChanges<T>({ site, version, prepare, onClose, onRestore, disabled, label = readablePath }: { site: string; version: number; prepare: () => Promise<CMSDocument<T>>; onClose: () => void; onRestore: () => void; disabled: boolean; label?: (path: string) => string }) {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [language, setLanguage] = useState("all");
  useEffect(() => { document.getElementById("cms-version-comparison-title")?.focus(); }, [version]);
  useEffect(() => {
    const abort = new AbortController(); setComparison(null); setError("");
    void prepare().then((document) => api<Comparison>(`${site}/documents/${document.id}/history/${version}/?current=${document.version}`, { signal: abort.signal })).then((value) => { if (!abort.signal.aborted) setComparison(value); }).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to compare versions."); });
    return () => abort.abort();
  }, [site, version, prepare, attempt]);
  const changes = comparison ? contentChanges(comparison.before, comparison.after) : [];
  const shown = changes.filter((change) => language === "all" || (changeLanguage(change.path) || "shared") === language);
  return <section className="cms-history-comparison" aria-label="Version comparison"><div className="cms-panel-heading"><h3 id="cms-version-comparison-title" tabIndex={-1}>Version {version} compared with saved draft</h3><div className="cms-row-actions"><button type="button" className="cms-button" onClick={() => { const trigger = document.querySelector<HTMLButtonElement>('.cms-history button[aria-pressed="true"]'); onClose(); requestAnimationFrame(() => trigger?.focus()); }}>Close comparison</button><RestoreButton version={version} disabled={disabled || !comparison} onRestore={onRestore} /></div></div><p className="cms-muted">The open draft is saved before comparison. Comparing does not restore or publish content.</p>
    {error && <ErrorMessage message={error} retry={() => setAttempt((value) => value + 1)} />}{!comparison && !error && <Loading label="Saving draft and comparing versions…" />}
    {comparison && <><div className="cms-review-heading"><strong>{changes.length} {changes.length === 1 ? "change" : "changes"} · current version {comparison.version}</strong><Select aria-label="Filter history changes by language" value={language} onValueChange={setLanguage}><option value="all">All languages and shared fields</option><option value="shared">Shared fields</option>{languages.filter(([code]) => site === "arms" || code !== "ru").map(([code, name]) => <option key={code} value={code}>{name}</option>)}</Select></div>{Object.keys(comparison.reference_labels).length > 0 && <p className="cms-muted">Reference names reflect current entries.</p>}<ChangeList changes={shown} before={comparison.before} after={comparison.after} media={comparison.media} references={comparison.reference_labels} beforeTitle={`Version ${version}`} afterTitle="Current saved draft" label={label} />{!shown.length && <p className="cms-muted">{changes.length ? "No changes match this filter." : "This version has the same content as the saved draft."}</p>}</>}
  </section>;
}
