import Collapsible from "../../components/ui/collapsible";
import { useEffect, useState, type ChangeEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, History, ImagePlus, Save } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api, APIError, dateTime, languages, mediaURL, statuses, revisionTitle } from "./api";
import type { CMSDocument, MediaRef, Revision } from "./api";
import type { ContentValue } from "./content-types";
import { useDocument } from "./use-document";
import { ErrorMessage, focusField, Loading, Modal, MoreActions, PreviewFrame, PreviewSurface, RestoreButton, SaveState } from "./ui";
import { useSession } from "./session";
import PublishReview from "./PublishReview";
import SectionGuide from "./SectionGuide";
import TranslationChecklist from "./TranslationChecklist";
import TranslationReview from "./TranslationReview";
import HistoryChanges from "./HistoryChanges";
import WebsiteComparison from "./WebsiteComparison";
import LanguageBar, { TranslationSummary } from "./LanguageBar";
import TranslationField from "./TranslationField";
import { blankTranslation, coverage, missingValues } from "./translations";
import { useEditorNavigation } from "./use-editor-navigation";
import MediaPicker from "./MediaPicker";
import CMSImage from "./CMSImage";
import { uploadError } from "./media";
import { pageSections, replacePageSection, pageCopyLimit } from "./page-sections";

type PageData = { name: string; slug: string; content: Record<string, Record<string, ContentValue>>; assets: Record<string, MediaRef> };
type PageRow = { name: string; slug: string; target_id: number; document_id: string | null; status: "published" | "changes"; updated_at: string };
const labels: Record<string, string> = { __main: "General", viewDocument: "Open document", downloadDocument: "Download document", slideAria: "Slide control label", main: "Home", aboutUs: "About us", technology: "Technology", solutions: "Solutions", support: "Support", permitsCertificates: "Permits and certificates", hero: "Hero", intro: "Introduction", decisions: "Decision making", find: "Search", track: "Support services", assess: "Assessment", attack: "Action", bda: "Outcome assessment", prediction: "Forecast", result: "Result", title: "Title", description: "Description", text: "Text", kicker: "Eyebrow text", cta: "Button label", overview: "Overview", modules: "Modules", integration: "Integration", contact: "Contact details", form: "Form", documents: "Documents", view: "Open", download: "Download", missionVision: "Mission and vision", lifecycle: "Lifecycle", org: "Organisation", capabilities: "Capabilities", people: "Team and training", differentiators: "Benefits", focusAreas: "Focus areas", systemIntegration: "System integration", customerBenefits: "Customer benefits", droneCarousel: "Product catalogue", cards: "Cards", items: "Items", phases: "Stages", highlights: "Highlights", bullets: "Items", units: "Divisions", areas: "Focus areas", video: "Video", illustration1: "Illustration 1", illustration2: "Illustration 2", illustration3: "Illustration 3", industrialSecurity: "Industrial safety", ministryPermit: "Ministry permit", categoryAExemption: "Category A exemption", categoryAExemptionAmended: "Category A exemption addendum", weaponsLicense: "Firearms licence", descriptionPrimary: "Body text", descriptionSecondary: "Additional text", hqAddress: "Address", hqTitle: "Address label", addressesLabel: "Addresses heading", slideAlt: "Slide description", pill: "Tag" };
const pageNames: Record<string, string> = { home: "Home", "about-us": "About us", technology: "Technology", solutions: "Solutions", support: "Support", "permits-certificates": "Permits and certificates" };
function label(key: string) { return labels[key] || (/^text\d+$/.test(key) ? `Text ${key.slice(4)}` : /^hero\d+$/.test(key) ? `Slide ${Number(key.slice(4)) + 1}` : /^slide\d+$/.test(key) ? `Slide ${key.slice(5)}` : key.replace(/([a-z])([A-Z])/g, "$1 $2")); }
function pageFieldLabel(path: string) {
  return path.split(".").filter((part) => part !== "content").map((part) => languages.find(([code]) => code === part)?.[1] || (/^\d+$/.test(part) ? String(Number(part) + 1) : part === "assets" ? "Images and files" : label(part))).join(" · ");
}

function CopyFields({ value, original, compare, errors, onChange, name, path }: { value: ContentValue; original: ContentValue; compare: boolean; errors: Record<string, string>; onChange: (value: ContentValue) => void; name: string; path: string }) {
  if (typeof value === "string") {
    const limit = pageCopyLimit(path);
    const nearLimit = value.length >= limit * 0.9;
    const variables = typeof original === "string" ? original.match(/\{\{\s*\w+\s*\}\}/g) || [] : [];
    const attributes = { id: path, "aria-label": name, maxLength: Math.max(limit, value.length), value, "aria-invalid": Boolean(errors[path]), "aria-describedby": [errors[path] ? path + "-error" : "", variables.length ? path + "-variables" : "", nearLimit ? path + "-limit" : ""].filter(Boolean).join(" "), onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
    return <TranslationField compare={compare} original={original} value={value} label={name} onCopy={() => { if (typeof original === "string") onChange(original); }}><label className="cms-field"><span>{name}</span>{limit === 255 ? <input {...attributes} /> : <textarea {...attributes} rows={5} />}{nearLimit && <small id={path + "-limit"} className="cms-limit">{value.length}/{Math.max(limit, value.length)} characters</small>}{variables.length > 0 && <small id={path + "-variables"}>Keep {variables.join(", ")} unchanged. These values are filled in automatically.</small>}{errors[path] && <small className="cms-field-error" id={path + "-error"}>{errors[path]}</small>}</label></TranslationField>;
  }
  if (Array.isArray(value)) return <div className="cms-page-copy-list" id={path} tabIndex={-1}>{value.map((item, index) => <div key={index} className="cms-page-copy-item"><div className="cms-content-block-heading"><strong>{name} · {index + 1}</strong><div className="cms-row-actions">{[-1, 1].map((direction) => <button className="cms-icon" type="button" key={direction} disabled={direction < 0 ? index === 0 : index === value.length - 1} aria-label={`${name} ${index + 1}: ${direction < 0 ? "up" : "down"}`} onClick={() => { const rows = [...value]; [rows[index], rows[index + direction]] = [rows[index + direction], rows[index]]; onChange(rows); }}>{direction < 0 ? <ArrowUp /> : <ArrowDown />}</button>)}</div></div><CopyFields value={item} original={Array.isArray(original) ? original[index] ?? null : null} compare={compare} errors={errors} name={name} path={`${path}.${index}`} onChange={(next) => onChange(value.map((row, position) => position === index ? next : row))} /></div>)}</div>;
  if (value && typeof value === "object") return <div id={path} tabIndex={-1}>{Object.entries(value).map(([key, item]) => {
    const field = <CopyFields key={key} value={item} original={original && typeof original === "object" && !Array.isArray(original) ? original[key] ?? null : null} compare={compare} errors={errors} name={label(key)} path={`${path}.${key}`} onChange={(next) => onChange({ ...value, [key]: next })} />;
    return typeof item === "string" ? field : <Collapsible className="cms-details" key={key} invalid={Object.keys(errors).some((error) => error.startsWith(`${path}.${key}`))} defaultOpen title={<>{label(key)}</>}>{field}</Collapsible>;
  })}</div>;
  return null;
}

export default function Pages() {
  const { site = "arms" } = useParams();
  const [items, setItems] = useState<PageRow[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => { const abort = new AbortController(); setItems(null); setError(""); void api<{ items: PageRow[] }>(`${site}/pages/`, { signal: abort.signal }).then((result) => setItems(result.items)).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load pages."); }); return () => abort.abort(); }, [site, attempt]);
  return <section className="cms-page"><header className="cms-page-heading"><div><h1>Pages</h1><p className="cms-muted">Page content within the existing website layouts.</p></div></header>{error && <ErrorMessage message={error} retry={() => setAttempt((value) => value + 1)} />}{!items && !error && <Loading />}<div className="cms-pages-list">{items?.map((item) => <Link key={item.target_id} to={`/${site}/pages/${item.document_id || `live-${item.target_id}`}`}><div><h2>{pageNames[item.slug] || item.name}</h2><p className="cms-muted">/{item.slug === "home" ? "" : item.slug}</p></div><div><span className={`cms-status cms-status-${item.status}`}>{statuses[item.status]}</span><time dateTime={item.updated_at}>{dateTime(item.updated_at)}</time></div></Link>)}</div></section>;
}

export function PageEditorRoute() {
  const { site = "arms", id = "" } = useParams();
  return <PageEditor key={`${site}:${id}`} site={site} id={id} />;
}

function PageEditor({ site, id }: { site: string; id: string }) {
  const editor = useDocument<PageData>(site, id, "pages");
  const { data, document } = editor;
  const { language, setLanguage, section, setSection } = useEditorNavigation(site, "", Boolean(data));
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState("");
  const [publish, setPublish] = useState(false);
  const [history, setHistory] = useState<Revision[] | null>(null);
  const [historyMore, setHistoryMore] = useState(false);
  const [comparisonVersion, setComparisonVersion] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ revision?: number; published?: boolean } | null>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width:600px)").matches);
  const [reloadOpen, setReloadOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const { session } = useSession();
  async function action(name: string, extra: Record<string, unknown> = {}) {
    setBusy(name); setNotice("");
    try { const latest = name === "stash" ? document : await editor.flush(); if (!latest) return; const result = await api<CMSDocument<PageData>>(`${site}/documents/${latest.id}/${name}/`, { method: "POST", body: JSON.stringify({ version: latest.version, ...(name === "stash" ? { data } : {}), ...extra }) }); editor.replace(result); setPublish(false); setHistory(null); setNotice(name === "stash" ? "Your version was saved separately in history. The latest page version is now open." : name === "publish" ? session?.environment === "local" ? "Published to the local copy. Public websites are unchanged." : `Page published on ${site === "arms" ? "arms.ai-def.com" : "ai-def.com"}.` : name === "restore" ? "Version restored as a draft. Publish to update the website." : ""); }
    catch (failure) { setPublish(false); editor.report(failure); }
    finally { setBusy(""); }
  }
  async function openHistory(before?: number) {
    if (!before) setComparisonVersion(null);
    if (!document) return;
    setBusy("history");
    try {
      const result = await api<{ items: Revision[] }>(`${site}/documents/${document.id}/history/${before ? `?before=${before}` : ""}`);
      setHistory((previous) => before ? [...(previous || []), ...result.items] : result.items);
      setHistoryMore(result.items.length === 30);
    } catch (failure) { editor.report(failure); }
    finally { setBusy(""); }
  }
  async function showPreview(revision?: number) { setBusy("preview"); try { await editor.flush(); setPreview({ revision }); setHistory(null); } catch (failure) { editor.report(failure); } finally { setBusy(""); } }
  if (!data || !document) return editor.error ? <section className="cms-page"><ErrorMessage message={editor.error} retry={editor.reload} /></section> : <Loading />;
  const selected = data.content[language] && Object.keys(data.content[language]).length ? data.content[language] : blankTranslation(data.content.en) as Record<string, ContentValue>;
  const namespace = Object.keys(selected)[0];
  const contents = selected[namespace];
  const blocks = contents && typeof contents === "object" && !Array.isArray(contents) ? pageSections(contents) : [];
  const active = section === "media" || blocks.some(([key]) => key === section) ? section : blocks[0]?.[0] || "media";
  const previewFocus = active === "media" ? "assets" : `content.${language}.${namespace}${active === "__main" ? "" : `.${active}`}`;
  const current = blocks.find(([key]) => key === active);
  const restrictedCarousel = data.slug === "home" && active === "droneCarousel";
  const currentValue = restrictedCarousel && current?.[1] && typeof current[1] === "object" && !Array.isArray(current[1]) ? Object.fromEntries(Object.entries(current[1]).filter(([key]) => ["title", "description"].includes(key))) : current?.[1];
  const originalContents = data.content.en[namespace];
  const originalValue = originalContents && typeof originalContents === "object" && !Array.isArray(originalContents) ? pageSections(originalContents).find(([key]) => key === active)?.[1] : null;
  const currentOriginal = restrictedCarousel && originalValue && typeof originalValue === "object" && !Array.isArray(originalValue) ? Object.fromEntries(Object.entries(originalValue).filter(([key]) => ["title", "description"].includes(key))) : originalValue;
  const languageCoverage = (code: string) => coverage(data.content.en, data.content[code]);
  const disabled = Boolean(busy) || editor.uploading > 0;
  const role = session?.sites.find((item) => item.id === site)?.role;
  const canPublish = role === "manager" || role === "publisher";
  const assets = Object.entries(data.assets);
  function fieldError(path: string) {
    const parts = path.split(".");
    if (parts[0] === "content") {
      if (parts[1]) setLanguage(parts[1]);
      if (parts[3]) setSection(contents && typeof contents === "object" && !Array.isArray(contents) && typeof contents[parts[3]] === "string" ? "__main" : parts[3]);
    } else if (parts[0] === "assets") setSection("media");
    window.setTimeout(() => focusField(path), 0);
  }
  return <article className="cms-editor"><header className="cms-editor-toolbar"><div className="cms-editor-title"><Link className="cms-back" to={`/${site}/pages`}><ArrowLeft />Pages</Link><div><h1 tabIndex={-1} title={pageNames[data.slug] || data.name}>{pageNames[data.slug] || data.name}</h1><span className={`cms-status cms-status-${document.status}`}>{statuses[document.status]}</span></div></div></header><div className="cms-editor-actions"><SaveState context={`${site === "arms" ? "ARMS" : "AI DEF"} · ${language.toUpperCase()}${session?.environment === "local" ? " · Local" : ""}`} state={editor.state} uploading={editor.uploading} /><button className="cms-button" aria-label="Save draft" aria-keyshortcuts="Control+s Meta+s" title="Save draft · Ctrl/⌘+S" disabled={disabled || !editor.unsaved} onClick={() => { void editor.flush().catch(() => undefined); }}><Save />Save draft</button><button className="cms-button" disabled={disabled} onClick={() => { void showPreview(); }}><Eye />Preview</button>{canPublish && <button className="cms-button cms-primary" disabled={disabled || (document.status === "published" && !editor.unsaved)} onClick={() => setPublish(true)}>Review changes</button>}<MoreActions>{document.target_id !== null && <button disabled={disabled} onClick={() => setWebsiteOpen(true)}>Compare with website</button>}<button disabled={disabled} onClick={() => { void openHistory(); }}><History />Version history</button></MoreActions></div>
    {editor.error && <div className="cms-editor-errors" role="alert"><strong>{editor.error}</strong>{Object.entries(editor.fields).map(([path, message]) => <button key={path} onClick={() => fieldError(path)}><span>{path.split(".").slice(1).map((part) => /^(en|de|sk|es|fr|it|ru)$/.test(part) ? part.toUpperCase() : /^\d+$/.test(part) ? String(Number(part) + 1) : label(part)).join(" · ")}: {message}</span><span>Go to field <ArrowRight aria-hidden="true" /></span></button>)}{editor.conflict && <div className="cms-row-actions"><button className="cms-button" disabled={disabled} onClick={() => { void action("stash"); }}>Save my version to history</button><button className="cms-button" onClick={() => setReloadOpen(true)}>Open latest version</button></div>}</div>}
    {notice && <p className="cms-notice" role="status">{notice}{document.status === "published" && <button className="cms-button" onClick={() => setPreview({ published: true })}>View published version</button>}</p>}<div className="cms-editor-layout"><nav className="cms-section-nav" aria-label="Page sections"><button className="cms-property-tab" aria-current={section === "properties" ? "page" : undefined} onClick={() => setSection("properties")}>Properties</button>{blocks.map(([key]) => <button key={key} aria-current={section !== "properties" && active === key ? "page" : undefined} onClick={() => setSection(key)}>{label(key)}{Object.keys(editor.fields).some((path) => path.startsWith("content.") && (path.split(".")[3] === key || key === "__main" && contents && typeof contents === "object" && !Array.isArray(contents) && typeof contents[path.split(".")[3]] === "string")) && <span className="cms-tab-error" role="img" aria-label="Contains errors">!</span>}</button>)}{assets.length > 0 && <button aria-current={section !== "properties" && active === "media" ? "page" : undefined} onClick={() => setSection("media")}>Images and files{Object.keys(editor.fields).some((path) => path.startsWith("assets")) && <span className="cms-tab-error" role="img" aria-label="Contains errors">!</span>}</button>}</nav><div className="cms-editor-content"><LanguageBar site={site} language={language} onLanguage={setLanguage} compare={compare} onCompare={setCompare} coverage={languageCoverage} /><SectionGuide kind="pages" section={section} /><TranslationChecklist language={language} tasks={language === "en" ? [] : missingValues(data.content.en, data.content[language], `content.${language}`).map((path) => ({ path, label: pageFieldLabel(path), missing: 1 }))} onField={(path) => { setCompare(true); fieldError(path); }}><TranslationReview key={language} document={document} language={language} prepare={editor.flush} onReviewed={editor.replace} onReload={editor.reload} label={pageFieldLabel} onField={(path) => { setCompare(true); fieldError(path); }} unsaved={editor.unsaved} disabled={disabled || editor.conflict} /></TranslationChecklist>{language !== "en" && !Object.keys(data.content[language] || {}).length && <p className="cms-notice">No translation yet. These fields are empty; the website currently uses English. Compare with EN to view the original.</p>}<div className={`cms-form-grid${section === "properties" ? " is-properties" : ""}`}><fieldset className="cms-editor-fields cms-form-main" disabled={disabled}><section className="cms-panel"><h2>{active === "media" ? "Images and documents" : label(active)}</h2>{current && active !== "media" && <CopyFields key={`${language}:${active}`} value={currentValue ?? null} original={currentOriginal ?? null} compare={compare && language !== "en"} errors={editor.fields} name={label(active)} path={`content.${language}.${namespace}${active === "__main" ? "" : `.${active}`}`} onChange={(value) => editor.change((previous) => ({ ...previous, content: { ...previous.content, [language]: { ...structuredClone(selected), [namespace]: replacePageSection(contents as Record<string, ContentValue>, active, restrictedCarousel ? { ...contents && typeof contents === "object" && !Array.isArray(contents) && (contents[active] as Record<string, ContentValue>), ...value as Record<string, ContentValue> } : value) } } }))} />}{active === "media" && assets.map(([key, ref]) => {
      const url = mediaURL(ref, editor.media); const isPDF = data.slug === "permits-certificates"; const isVideo = key === "video" || key === "hero0";
      return <div className="cms-field" key={key}><label>{label(key)}</label>{isPDF ? <a className="cms-button" href={url} target="_blank" rel="noreferrer">Open current PDF</a> : isVideo ? <video controls preload="metadata" className="cms-page-asset" src={url} /> : <CMSImage className="cms-page-asset" src={url} />}<MediaPicker context={`${label(key)} · ${pageNames[data.slug] || data.name}`} site={site} kind={isPDF ? "document" : isVideo ? "video" : "image"} currentURL={url} label="Choose from library" trackUpload={editor.trackUpload} onChoose={([asset]) => { editor.addMedia(asset.ref.asset_id, asset.url); editor.change((previous) => ({ ...previous, assets: { ...previous.assets, [key]: asset.ref } })); }} /><label className="cms-button cms-file"><ImagePlus />Replace file<input id={`assets.${key}`} aria-label={`Replace: ${label(key)}`} type="file" accept={isPDF ? "application/pdf" : isVideo ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp"} onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; const problem = uploadError(file, isPDF ? "document" : isVideo ? "video" : "image"); if (problem) { editor.report(new Error(problem)); return; } const form = new FormData(); form.append("file", file); form.append("kind", isPDF ? "document" : isVideo ? "video" : "image");
        const task = api<{ ref: MediaRef; url: string }>(`${site}/uploads/`, { method: "POST", body: form }).then((result) => { if ("asset_id" in result.ref) editor.addMedia(result.ref.asset_id, result.url); editor.change((previous) => ({ ...previous, assets: { ...previous.assets, [key]: result.ref } })); }); editor.trackUpload(task); void task.catch(editor.report); event.target.value = "";
      }} /></label><small>File changes apply to all languages.</small></div>;
    })}</section></fieldset><aside className="cms-properties"><section className="cms-panel"><h2>Page properties</h2><p className="cms-muted">The layout and URL are fixed. Edit the content of the predefined sections here.</p><p className="cms-context">URL: /{data.slug === "home" ? "" : data.slug}</p><p className="cms-context">Draft updated: {dateTime(document.updated_at)}</p><TranslationSummary site={site} reviews={document.translation_review} unsaved={editor.unsaved} coverage={languageCoverage} onLanguage={setLanguage} /></section></aside></div></div></div>
    {websiteOpen && <WebsiteComparison site={site} prepare={editor.flush} label={pageFieldLabel} onClose={() => setWebsiteOpen(false)} onResolved={(value) => { editor.replace(value); setNotice("Your draft was preserved in Version history. The current website version is now open. Nothing was published."); }} />}
    <Modal open={reloadOpen} onClose={() => setReloadOpen(false)} title="Open latest version?" description="Changes in the open form will be replaced. Save your version to history first to keep them."><footer><button className="cms-button" onClick={() => setReloadOpen(false)}>Stay</button><button className="cms-button" onClick={() => { setReloadOpen(false); editor.reload(); }}>Replace my version</button></footer></Modal>
    {publish && <PublishReview onWebsite={document.target_id !== null ? () => { setPublish(false); setWebsiteOpen(true); } : undefined} onError={editor.report} site={site} kind="pages" title={pageNames[data.slug] || data.name} prepare={editor.flush} label={pageFieldLabel} busy={Boolean(busy)} onClose={() => setPublish(false)} onField={(path, fields) => { if (fields) editor.report(new APIError("Fix before publishing.", 422, fields)); fieldError(path); }} onPublish={(version) => { void action("publish", { version }); }} />}
    <Modal className="cms-history-modal" open={history !== null} onClose={() => setHistory(null)} title="Page history" description="You can preview and restore the previous version as a draft."><div className="cms-history-body">{editor.error && <ErrorMessage message={editor.error} />}{comparisonVersion !== null && <HistoryChanges site={site} version={comparisonVersion} prepare={editor.flush} disabled={disabled} onRestore={() => { void action("restore", { restore_version: comparisonVersion }); }} label={pageFieldLabel} onClose={() => setComparisonVersion(null)} />}<div className="cms-history">{history?.map((revision) => <div key={revision.version}><strong>{revisionTitle(revision.action)}</strong><small>Version {revision.version} · {dateTime(revision.created_at)} · {revision.author}</small><div className="cms-row-actions"><button className="cms-button" disabled={disabled} aria-pressed={comparisonVersion === revision.version} onClick={() => setComparisonVersion(revision.version)}>Compare changes</button><button className="cms-button" disabled={disabled} onClick={() => { void showPreview(revision.version); }}>Preview</button><RestoreButton version={revision.version} disabled={disabled} onRestore={() => { void action("restore", { restore_version: revision.version }); }} /></div></div>)}</div>{historyMore && <button className="cms-button" disabled={disabled} onClick={() => { void openHistory(history?.at(-1)?.version); }}>Earlier versions</button>}</div></Modal>
    <PreviewSurface open={preview !== null} onClose={() => setPreview(null)} title={preview?.published ? "Published version" : preview?.revision ? `Preview · version ${preview.revision}` : "Page preview"}><div className="cms-preview-tools"><span>{site === "arms" ? "ARMS" : "AI DEF"} · {pageNames[data.slug] || data.name} · {language.toUpperCase()}</span><div><button className="cms-button" aria-pressed={!mobile} onClick={() => setMobile(false)}>Desktop</button><button className="cms-button" aria-pressed={mobile} onClick={() => setMobile(true)}>Phone</button></div></div>{preview && <PreviewFrame currentVersion={document.version} unsaved={editor.unsaved} refresh={editor.flush} focusPath={preview.revision || preview.published ? undefined : previewFocus} onField={preview.revision || preview.published ? undefined : (path) => { if (!window.matchMedia("(min-width:1600px)").matches) setPreview(null); window.setTimeout(() => fieldError(path), 0); }} mobile={mobile} title="Page preview" src={`/cms/${site}/preview/${document.id}/${language}?${new URLSearchParams({ kind: "pages", ...(preview.revision ? { revision: String(preview.revision) } : {}), ...(preview.published ? { published: "1" } : {}) })}`} />}</PreviewSurface>
    <Modal open={editor.blocker.state === "blocked" && editor.state === "error"} onClose={() => { if (editor.blocker.state === "blocked") editor.blocker.reset(); }} title="Unable to save changes" description="Your changes remain in the open form."><footer><button className="cms-button cms-primary" onClick={() => { if (editor.blocker.state === "blocked") editor.blocker.reset(); }}>Stay</button><button className="cms-button" onClick={() => { if (editor.blocker.state === "blocked") editor.blocker.proceed(); }}>Leave without saving</button></footer></Modal>
  </article>;
}
