import { useEffect, useState } from "react";
import type { CMSDocument } from "./api";
import { api, APIError, languages } from "./api";
import { changeLanguage, contentChanges, readablePath } from "./changes";
import { ErrorMessage, Loading, Modal } from "./ui";
import Select from "../../components/ui/select";
import { useSession } from "./session";
import ChangeList from "./ChangeList";
import type { ReferenceLabels } from "./ChangeList";

type Review = { version: number; before: unknown; after: unknown; media: Record<string, string>; reference_labels: ReferenceLabels; ready: boolean; error: string; fields: Record<string, string>; affected: { id: number; name: string; available: boolean }[] };

export default function PublishReview<T>({ site, title, kind, prepare, onPublish, onClose, onField, onError, onWebsite, label = readablePath, busy }: {
  site: string; title: string; kind: string; prepare: () => Promise<CMSDocument<T>>; onPublish: (version: number) => void;
  onClose: () => void; onField: (path: string, fields?: Record<string, string>) => void; onError: (error: unknown) => void; onWebsite?: () => void; label?: (path: string) => string; busy: boolean;
}) {
  const { session } = useSession();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [language, setLanguage] = useState("all");
  useEffect(() => {
    const abort = new AbortController();
    setReview(null); setError(""); setConflict(false);
    void prepare().then((document) => api<Review>(`${site}/documents/${document.id}/review/`, { method: "POST", body: JSON.stringify({ version: document.version }), signal: abort.signal })).then((result) => { if (!abort.signal.aborted) setReview(result); }).catch((failure: unknown) => { if (!abort.signal.aborted) { setError(failure instanceof Error ? failure.message : "Unable to review changes."); setConflict(failure instanceof APIError && failure.status === 409); onError(failure); } });
    return () => abort.abort();
  }, [site, prepare, onError, attempt]);
  const changes = review ? contentChanges(review.before, review.after) : [];
  const shown = changes.filter((change) => language === "all" || (changeLanguage(change.path) || "shared") === language);
  const local = session?.environment === "local";
  return <Modal open onClose={onClose} preventDismiss={busy} className="cms-review-modal" title="Review changes" description={`${title} · ${site === "arms" ? "ARMS website" : kind === "portal" || kind === "modules" ? "AI DEF client portal" : "AI DEF website"}`}><div className="cms-review-body">
    {local && <p className="cms-notice">Local copy — this updates the local site only. Public websites are unchanged.</p>}
    <p className="cms-context">The entire material and all translations in this draft will be published. Missing translations use English.</p>
    {error && <ErrorMessage message={error} retry={() => setAttempt((value) => value + 1)} />}
    {conflict && onWebsite && <button className="cms-button" onClick={onWebsite}>Compare with website</button>}
    {!review && !error && <Loading label="Saving draft and checking publication…" />}
    {review && <>
      <section className="cms-review-readiness" aria-labelledby="cms-review-ready"><h3 id="cms-review-ready">{review.ready ? "Ready to publish" : "Fix before publishing"}</h3><p className="cms-muted">{review.ready ? "Required fields passed publication checks. Check the changes and preview; translation quality needs human review." : review.error}</p>{Object.entries(review.fields).map(([path, message]) => <button className="cms-review-field" type="button" key={path} onClick={() => { onClose(); window.setTimeout(() => onField(path, review.fields), 0); }}><strong>{label(path)}</strong><span>{message} · Go to field</span></button>)}</section>
      {review.affected.length > 0 && <section className="cms-review-readiness"><h3>Shared module · affected products</h3><p className="cms-muted">These products use the published module:</p><ul>{review.affected.map((product) => <li key={product.id}>{product.name}{!product.available && " (not published)"}</li>)}</ul></section>}
      <div className="cms-review-heading"><h3>{review.before === null ? "First publication" : "Changes from the website"} · {changes.length}</h3><label><span className="cms-sr">Filter changes by language</span><Select aria-label="Filter changes by language" value={language} onValueChange={setLanguage}><option value="all">All languages and shared fields</option><option value="shared">Shared fields</option>{languages.filter(([code]) => site === "arms" || code !== "ru").map(([code, name]) => <option key={code} value={code}>{name}</option>)}</Select></label></div>
      {Object.keys(review.reference_labels).length > 0 && <p className="cms-muted">Reference names reflect current entries.</p>}<ChangeList changes={shown} before={review.before} after={review.after} media={review.media} references={review.reference_labels} beforeTitle="On website" afterTitle="In this draft" label={label} onEdit={(path) => { onClose(); window.setTimeout(() => onField(path), 0); }} />{!shown.length && <p className="cms-muted">{changes.length ? "No changes match this filter." : "No content differences. Publishing also updates visibility and checks the saved draft."}</p>}
    </>}
    </div><footer><button className="cms-button" disabled={busy} onClick={onClose}>Back to editing</button><button className="cms-button cms-primary" disabled={busy || !review?.ready} onClick={() => { if (review) onPublish(review.version); }}>{busy ? "Publishing…" : local ? "Publish to local copy" : "Publish changes"}</button></footer>
  </Modal>;
}
