import { useState } from "react";
import { api, APIError, dateTime, languages } from "./api";
import type { CMSDocument } from "./api";
import { reviewLabel } from "./translations";
import { ErrorMessage, Modal } from "./ui";

const reasons = { source_changed: "English text or image changed", translation_changed: "Translation changed", unreviewed: "Not reviewed", missing: "Translation missing" };

export default function TranslationReview<T>({ document, language, prepare, onReviewed, onReload, label, onField, unsaved, disabled }: {
  document: CMSDocument<T>; language: string; prepare: () => Promise<CMSDocument<T>>; onReviewed: (document: CMSDocument<T>) => void; onReload: () => void;
  label: (path: string) => string; onField: (path: string) => void; unsaved: boolean; disabled: boolean;
}) {
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const status = document.translation_review?.[language];
  const name = languages.find(([code]) => code === language)?.[1] || language.toUpperCase();
  const issues = status?.issues.filter((issue) => issue.state !== "missing") || [];
  const reviewed = !unsaved && status !== undefined && status.total > 0 && status.reviewed === status.total;
  async function mark() {
    setBusy(true); setError(""); setErrors({}); setConflict(false);
    let stale = false;
    try {
      const current = await prepare();
      if (current.version !== confirmVersion) { stale = true; throw new Error("The draft changed. Load the latest draft and check its values before marking reviewed."); }
      const result = await api<CMSDocument<T>>(`${document.site}/documents/${document.id}/translations/`, { method: "POST", body: JSON.stringify({ version: confirmVersion, language }) });
      onReviewed(result); setConfirmVersion(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to record the translation review.");
      setErrors(failure instanceof APIError ? failure.fields : {});
      setConflict(stale || failure instanceof APIError && failure.status === 409);
    } finally { setBusy(false); }
  }
  return <div className="cms-translation-review"><div className="cms-panel-heading"><div><strong>{reviewLabel(status, unsaved)}</strong><p className="cms-muted">{status?.checked_at ? `Last checked ${dateTime(status.checked_at)}. ` : ""}{reviewed ? "Current values match this manual check." : "Check the listed fields against English. Marking reviewed does not publish."}</p></div>{!reviewed && <button type="button" className="cms-button" disabled={disabled || busy || unsaved || !status?.total || Boolean(status.missing)} onClick={() => { setConfirmVersion(document.version); setError(""); setErrors({}); setConflict(false); }}>Mark as reviewed</button>}</div>
    {!unsaved && issues.length > 0 && <details><summary>Fields to review · {issues.length}</summary><ul>{issues.map((issue) => <li key={issue.path}><button type="button" onClick={() => onField(issue.path)}><span>{label(issue.path)}</span><small>{reasons[issue.state]}</small></button></li>)}</ul></details>}
    <Modal open={confirmVersion !== null} onClose={() => setConfirmVersion(null)} preventDismiss={busy} title={`Mark ${name} translation reviewed?`} description="Confirm that you have checked the translated values against the current English text and images. This records your manual review and does not change the website.">{error && <ErrorMessage message={error} />}{conflict && !unsaved && <button type="button" className="cms-button" disabled={busy} onClick={() => { setConfirmVersion(null); onReload(); }}>Load latest draft and check again</button>}{Object.entries(errors).map(([path, message]) => <button type="button" className="cms-review-field" key={path} onClick={() => { setConfirmVersion(null); window.setTimeout(() => onField(path), 0); }}><strong>{label(path)}</strong><span>{message}</span></button>)}<footer><button type="button" className="cms-button" disabled={busy} onClick={() => setConfirmVersion(null)}>Back to checking</button><button type="button" className="cms-button cms-primary" disabled={busy || conflict} onClick={() => { void mark(); }}>{busy ? "Recording…" : "Confirm reviewed"}</button></footer></Modal>
  </div>;
}
