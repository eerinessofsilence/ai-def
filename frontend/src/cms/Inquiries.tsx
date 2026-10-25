import Collapsible from "../../components/ui/collapsible";
import Select from "../../components/ui/select";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Search } from "lucide-react";
import { Link, useBlocker, useParams, useSearchParams } from "react-router-dom";
import { api, APIError, dateTime } from "./api";
import { EmptyState, ErrorMessage, Loading, Modal, Pagination } from "./ui";
import { useSession } from "./session";

const states: Record<string, string> = { new: "New", in_progress: "In progress", done: "Done", spam: "Spam" };
type Inquiry = { id: number; name: string; message: string; product: string; status: string; assigned_to: number | null; created_at: string; updated_at: string; email?: string; phone?: string; country?: string; address?: string; website?: string; source?: string; language?: string; internal_note?: string };
type Response = { item: Inquiry; assignees: { id: number; name: string }[] };
const fingerprint = (item: Inquiry) => JSON.stringify([item.status, item.assigned_to, item.internal_note || ""]);

export default function Inquiries() {
  const { site = "arms" } = useParams();
  return <InquiryList key={site} site={site} />;
}

function InquiryList({ site }: { site: string }) {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const [search, setSearch] = useState(params.get("q") || "");
  const [result, setResult] = useState<{ items: Inquiry[]; total: number; page: number; pages: number } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { session } = useSession();
  const canManage = session?.sites.find((item) => item.id === site)?.role === "manager";
  const hasFilters = Boolean(params.get("q") || params.get("state") || params.get("assigned") || params.get("source"));
  useEffect(() => { setSearch(params.get("q") || ""); }, [params]);
  useEffect(() => {
    const abort = new AbortController(); setResult(null); setError("");
    void api<typeof result>(`${site}/inquiries/?${query}`, { signal: abort.signal }).then(setResult).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load inquiries."); });
    return () => abort.abort();
  }, [site, query, attempt]);
  function filter(key: string, value: string) { const next = new URLSearchParams(params); next.delete("page"); if (value) next.set(key, value); else next.delete(key); setParams(next); }
  return <section className="cms-page"><header className="cms-page-heading"><div><h1>Inquiries{result && <span className="cms-count">{result.total}</span>}</h1><p className="cms-muted">{params.get("source") === "unknown" ? "Legacy inquiries with unknown source" : site === "arms" ? "arms.ai-def.com" : "ai-def.com"}</p></div></header><div className="cms-list-tools"><form className="cms-search" role="search" onSubmit={(event) => { event.preventDefault(); filter("q", search.trim()); }}><Search /><input type="search" aria-label="Search inquiries" placeholder="Name, email or message…" value={search} onChange={(event) => { setSearch(event.target.value); if (!event.target.value) filter("q", ""); }} /><button type="submit">Search</button></form><Select aria-label="Inquiry status" value={params.get("state") || ""} onValueChange={(selectedValue) => filter("state", selectedValue)}><option value="">All statuses</option>{Object.entries(states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select><Select aria-label="Assignee" value={params.get("assigned") || ""} onValueChange={(selectedValue) => filter("assigned", selectedValue)}><option value="">All team members</option><option value="me">Assigned to me</option></Select>{canManage && <Select aria-label="Inquiry source" value={params.get("source") || ""} onValueChange={(selectedValue) => filter("source", selectedValue)}><option value="">This site</option><option value="unknown">Unknown source</option></Select>}</div>{hasFilters && <div className="cms-filter-summary"><span>Filters applied</span><button type="button" onClick={() => setParams({})}>Clear filters</button></div>}{error && <ErrorMessage message={error} retry={() => setAttempt((previous) => previous + 1)} />}{!result && !error && <Loading />}{result && <><div className="cms-inquiry-list">{result.items.map((item) => <Link className="cms-inquiry-row" key={item.id} to={`/${site}/inquiries/${item.id}?${new URLSearchParams({ from: query })}`}><div><strong>{item.name}</strong><p>{item.message}</p><small>{item.product}</small></div><div><span className={`cms-status cms-inquiry-${item.status}`}>{states[item.status]}</span><time dateTime={item.created_at}>{dateTime(item.created_at)}</time></div></Link>)}{!result.items.length && <EmptyState title={hasFilters ? "No results found" : "No inquiries yet"} description={hasFilters ? "Change your search or clear the filters." : "New messages will appear here after a website form is submitted."} />}</div><Pagination {...result} onPage={(page) => { const next = new URLSearchParams(params); next.set("page", String(page)); setParams(next); }} /></>}</section>;
}

export function InquiryDetail() {
  const { site = "arms", id = "" } = useParams();
  return <InquiryEditor key={`${site}:${id}`} site={site} id={id} />;
}

function InquiryEditor({ site, id }: { site: string; id: string }) {
  const { beforeSignOut } = useSession();
  const [params] = useSearchParams();
  const [result, setResult] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedStatus, setSavedStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [original, setOriginal] = useState("");
  const [conflict, setConflict] = useState(false);
  const [preservedNote, setPreservedNote] = useState<string | null>(null);
  const dirty = result !== null && fingerprint(result.item) !== original;
  const unsaved = dirty || preservedNote !== null;
  const blocker = useBlocker(unsaved);
  useEffect(() => beforeSignOut(async () => { if (unsaved) throw new Error("Save the status, note and conflicting copy before signing out."); }), [beforeSignOut, unsaved]);
  useEffect(() => { if (!unsaved) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [unsaved]);
  useEffect(() => { const abort = new AbortController(); setResult(null); setError(""); void api<Response>(`${site}/inquiries/${id}/`, { signal: abort.signal }).then((response) => { setResult(response); setSavedStatus(response.item.status); setOriginal(fingerprint(response.item)); }).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load the inquiry."); }); return () => abort.abort(); }, [site, id, attempt]);
  useEffect(() => { if (!copied) return; const timer = window.setTimeout(() => setCopied(false), 2500); return () => window.clearTimeout(timer); }, [copied]);
  if (!result) return error ? <section className="cms-page"><ErrorMessage message={error} retry={() => setAttempt((previous) => previous + 1)} /></section> : <Loading />;
  const { item, assignees } = result;
  function change(fields: Partial<Inquiry>) { setSaved(false); setResult((previous) => previous ? { ...previous, item: { ...previous.item, ...fields } } : previous); }
  return <section className="cms-page"><Link className="cms-back" to={`/${site}/inquiries?${params.get("from") || ""}`}><ArrowLeft />Inquiries</Link><header className="cms-page-heading"><div><h1>{item.name}</h1><p className="cms-muted">{dateTime(item.created_at)} · {item.product || "General inquiry"}</p></div><span className={`cms-status cms-inquiry-${savedStatus || item.status}`}>{states[savedStatus || item.status]}</span></header><div className="cms-inquiry-layout"><div><section className="cms-panel"><h2>Message</h2><p className="cms-inquiry-message">{item.message}</p></section><section className="cms-panel cms-content-section"><h2>Contact details</h2><dl className="cms-contact-details"><dt>Email</dt><dd><a href={`mailto:${item.email}`}>{item.email}</a><button className="cms-icon" aria-label="Copy email" onClick={() => { void navigator.clipboard.writeText(item.email || "").then(() => setCopied(true)).catch(() => setError("Unable to copy the email. Select and copy it manually.")); }}><Copy /></button>{copied && <small role="status">Copied</small>}</dd>{item.phone && <><dt>Phone</dt><dd>{item.phone}</dd></>}{item.country && <><dt>Country</dt><dd>{item.country}</dd></>}{item.address && <><dt>Address</dt><dd>{item.address}</dd></>}{item.website && <><dt>Site</dt><dd>{item.website}</dd></>}</dl><Collapsible className="cms-details" title={<>Message source</>}><p className="cms-muted">{item.source || "Unknown"} · {item.language || "Unknown language"}</p></Collapsible></section></div><form className="cms-panel" onSubmit={(event) => {
    event.preventDefault(); setBusy(true); setError(""); setSaved(false); void api<Response>(`${site}/inquiries/${id}/`, { method: "PUT", body: JSON.stringify({ updated_at: item.updated_at, status: item.status, assigned_to: item.assigned_to, internal_note: item.internal_note || "" }) }).then((response) => { setResult(response); setSavedStatus(response.item.status); setOriginal(fingerprint(response.item)); setSaved(true); setConflict(false); }).catch((failure: unknown) => { setConflict(failure instanceof APIError && failure.status === 409); setError(failure instanceof Error ? failure.message : "Unable to save."); }).finally(() => setBusy(false));
  }}><fieldset className="cms-editor-fields" disabled={busy}><h2>Workflow</h2><p className={dirty ? "cms-notice" : "cms-muted"} role="status">{dirty ? "Unsaved changes. Save to update the status, assignee and note." : "Changes here are saved when you choose Save changes."}</p><label className="cms-field"><span>Status</span><Select value={item.status} onValueChange={(selectedValue) => change({ status: selectedValue })}>{Object.entries(states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></label><label className="cms-field"><span>Assignee</span><Select value={item.assigned_to || ""} onValueChange={(selectedValue) => change({ assigned_to: selectedValue ? Number(selectedValue) : null })}><option value="">Unassigned</option>{assignees.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></label><label className="cms-field"><span>Internal note</span><textarea aria-label="Internal note" aria-describedby="inquiry-note-help" rows={5} maxLength={20000} value={item.internal_note || ""} onChange={(event) => change({ internal_note: event.target.value })} /><small id="inquiry-note-help">Visible to team members. Not sent to the customer.</small></label>{error && <ErrorMessage message={error} />}{conflict && <p className="cms-notice">Saving paused: another team member changed this inquiry.<button type="button" onClick={() => { setPreservedNote(item.internal_note || ""); setConflict(false); setAttempt((value) => value + 1); }}>Open the latest version and preserve my note in this form</button></p>}{preservedNote !== null && <div className="cms-fallback"><strong>My note before the conflict</strong><textarea aria-label="Preserved conflicting note" value={preservedNote} readOnly rows={4} /><p>This copy stays here until you decide. Replacing the note below only updates the open form.</p><button type="button" onClick={() => { change({ internal_note: preservedNote }); setPreservedNote(null); }}>Use my note in the form</button><button type="button" onClick={() => setPreservedNote(null)}>Keep the latest note and discard this copy</button></div>}<button className="cms-button cms-primary cms-form-submit" disabled={busy || conflict || !dirty}>{busy ? "Saving…" : "Save changes"}</button>{saved && <p className="cms-success" role="status">Changes saved.</p>}</fieldset></form></div><Modal open={blocker.state === "blocked"} onClose={() => { if (blocker.state === "blocked") blocker.reset(); }} title="Unsaved changes" description="Save the status and internal note first, or explicitly leave without saving."><footer><button className="cms-button cms-primary" onClick={() => { if (blocker.state === "blocked") blocker.reset(); }}>Stay</button><button className="cms-button cms-danger" onClick={() => { if (blocker.state === "blocked") blocker.proceed(); }}>Leave without saving</button></footer></Modal></section>;
}
