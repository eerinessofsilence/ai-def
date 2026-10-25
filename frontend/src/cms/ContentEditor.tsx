import Collapsible from "../../components/ui/collapsible";
import Select from "../../components/ui/select";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Eye, History, Plus, Save, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, APIError, dateTime, languages, mediaURL, statuses, revisionTitle } from "./api";
import type { CMSDocument, MediaRef, Revision } from "./api";
import { articleBlockLabels as blockTypes, collectionNames, duplicateContentBlock, emptyNode, fieldLabel, nodeTitle, relationNeighbor } from "./content-types";
import type { ContentNode, NodeSchema } from "./content-types";
import ContentFields from "./ContentFields";
import { useDocument } from "./use-document";
import { ErrorMessage, focusField, Loading, Modal, MoreActions, PreviewFrame, PreviewSurface, RestoreButton, SaveState } from "./ui";
import { useSession } from "./session";
import LanguageBar, { TranslationSummary } from "./LanguageBar";
import { contentCoverage, contentMissing, plainText } from "./translations";
import { useEditorNavigation } from "./use-editor-navigation";
import CMSImage from "./CMSImage";
import { uploadError } from "./media";
import PublishReview from "./PublishReview";
import SectionGuide from "./SectionGuide";
import DraftGuide from "./DraftGuide";
import TranslationChecklist from "./TranslationChecklist";
import TranslationReview from "./TranslationReview";
import HistoryChanges from "./HistoryChanges";
import WebsiteComparison from "./WebsiteComparison";
import MaterialNavigation from "./MaterialNavigation";

const groups: Record<string, string> = { main: "General", photos: "Images", specs: "Specifications", blocks: "Page content", modules: "Modules", legacy: "Legacy article content", properties: "Properties" };
const propertyKeys = new Set(["category", "author", "published_at", "read_minutes", "slug", "serial_number", "tags"]);

function blockSummary(node: ContentNode, language: string) {
  const value = node.fields.html || node.fields.description || node.fields.paragraph;
  const text = value && typeof value === "object" && !Array.isArray(value) ? value[language] || value.en : value;
  return typeof text === "string" ? plainText(text).trim().slice(0, 120) : "";
}

export default function ContentEditorRoute() {
  const { site = "ai-def", kind = "products", id = "" } = useParams();
  return <ContentEditor key={`${site}:${kind}:${id}`} site={site} kind={kind} id={id} />;
}

function ContentEditor({ site, kind, id }: { site: string; kind: string; id: string }) {
  const editor = useDocument<ContentNode>(site, id, kind);
  const { data, document, media } = editor;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session } = useSession();
  const [schema, setSchema] = useState<NodeSchema | null>(null);
  const [schemaError, setSchemaError] = useState("");
  const [schemaAttempt, setSchemaAttempt] = useState(0);
  const { language, setLanguage, section: requestedSection, setSection } = useEditorNavigation(site, kind === "articles" ? "blocks" : "main", Boolean(data && schema));
  const [compare, setCompare] = useState(false);
  const [addingBlock, setAddingBlock] = useState(false);
  const [insertAfter, setInsertAfter] = useState<string | number | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<"publish" | "unpublish" | "reload" | null>(null);
  const [history, setHistory] = useState<Revision[] | null>(null);
  const [historyMore, setHistoryMore] = useState(false);
  const [comparisonVersion, setComparisonVersion] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ revision?: number; published?: boolean } | null>(null);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width:600px)").matches);
  const [remove, setRemove] = useState<{ key: string; id: string | number } | null>(null);
  const role = session?.sites.find((item) => item.id === site)?.role;
  const canPublish = role === "publisher" || role === "manager";
  useEffect(() => {
    const abort = new AbortController();
    setSchemaError("");
    void api<NodeSchema>(`${site}/schema/${kind}/`, { signal: abort.signal }).then(setSchema).catch((failure: unknown) => { if (!abort.signal.aborted) setSchemaError(failure instanceof Error ? failure.message : "Unable to load the editor."); });
    return () => abort.abort();
  }, [site, kind, schemaAttempt]);

  async function action(name: string, extra: Record<string, unknown> = {}) {
    setBusy(name); setNotice("");
    try {
      const latest = name === "duplicate" ? document : await editor.flush();
      if (!latest) return;
      const result = await api<CMSDocument<ContentNode>>(`${site}/documents/${latest.id}/${name}/`, { method: "POST", body: JSON.stringify({ version: latest.version, ...(name === "duplicate" ? { data } : {}), ...extra }) });
      editor.replace(result); setConfirmation(null); setHistory(null);
      setNotice(name === "publish" ? session?.environment === "local" ? "Published to the local copy. Public websites are unchanged." : kind === "portal" || kind === "modules" ? "Content published to the client portal." : "Content published on ai-def.com." : name === "unpublish" ? "Content unpublished." : name === "restore" ? "Version restored as a draft. Publish to update the website." : "");
      if (name === "duplicate") await navigate(`/${site}/${kind}/${result.id}`);
    } catch (failure) { setConfirmation(null); editor.report(failure); }
    finally { setBusy(""); }
  }
  async function openPreview(revision?: number) {
    setBusy("preview");
    try { await editor.flush(); setPreview({ revision }); setHistory(null); }
    catch (failure) { editor.report(failure); }
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
  function upload(file: File, callback: (ref: MediaRef) => void, kind: "image" | "video") {
    const problem = uploadError(file, kind);
    if (problem) { editor.report(new Error(problem)); return; }
    const form = new FormData(); form.append("file", file); form.append("kind", kind);
    const task = api<{ ref: MediaRef; url: string }>(`${site}/uploads/`, { method: "POST", body: form }).then((result) => {
      if ("asset_id" in result.ref) editor.addMedia(result.ref.asset_id, result.url);
      callback(result.ref);
    });
    editor.trackUpload(task); void task.catch(editor.report);
  }
  if (schemaError) return <section className="cms-page"><ErrorMessage message={schemaError} retry={() => { editor.reload(); setSchemaAttempt((value) => value + 1); }} /></section>;
  if (!data || !document || !schema) return editor.error ? <section className="cms-page"><ErrorMessage message={editor.error} retry={editor.reload} /></section> : <Loading />;
  const relations = Object.entries(schema.relations);
  const availableGroups = [...(kind === "articles" ? [] : ["main"]), ...Array.from(new Set(relations.filter(([key, value]) => value.group !== "legacy" || data.sections[key]?.length && !data.sections.blocks?.length).map(([, value]) => value.group))), "properties"];
  if (schema.fields.some((field) => field.type === "file") && !availableGroups.includes("photos")) availableGroups.splice(1, 0, "photos");
  const section = availableGroups.includes(requestedSection) ? requestedSection : kind === "articles" ? "blocks" : "main";
  const contentSection = section === "properties" ? kind === "articles" ? "blocks" : "main" : section;
  const disabled = Boolean(busy) || editor.uploading > 0;
  const title = nodeTitle(data, language) || (kind === "articles" ? "New article" : "New content");
  function updateChild(key: string, identifier: number | string, value: ContentNode) {
    editor.change((previous) => ({ ...previous, sections: { ...previous.sections, [key]: previous.sections[key].map((child) => child.id === identifier ? value : child) } }));
  }
  function shift(key: string, index: number, direction: number) {
    const trigger = window.document.activeElement?.closest("[data-cms-collapse]")?.querySelector<HTMLButtonElement>(".ui-collapse-trigger");
    editor.change((previous) => {
      const rows = [...previous.sections[key]];
      const target = relationNeighbor(rows, index, direction);
      if (target === undefined) return previous;
      [rows[index], rows[target]] = [rows[target], rows[index]];
      return { ...previous, sections: { ...previous.sections, [key]: rows } };
    });
    window.requestAnimationFrame(() => trigger?.focus({ preventScroll: true }));
  }
  function addChild(key: string, relation: NodeSchema, blockKind?: string, group: string | number | null = null) {
    const child = emptyNode(relation);
    if (blockKind) child.fields.kind = blockKind;
    if (relation.fields.some((field) => field.key === "block")) child.fields.block = group;
    let index = data!.sections[key]?.length || 0;
    editor.change((previous) => {
      const rows = [...(previous.sections[key] || [])];
      const after = key === "blocks" && insertAfter !== null ? rows.findIndex((row) => row.id === insertAfter) : -1;
      index = after >= 0 ? after + 1 : rows.length;
      rows.splice(index, 0, child);
      return { ...previous, sections: { ...previous.sections, [key]: rows } };
    });
    setAddingBlock(false); setInsertAfter(null);
    window.requestAnimationFrame(() => focusField(`sections.${key}.${index}`));
  }
  function duplicateChild(key: string, child: ContentNode) {
    const copy = duplicateContentBlock(child);
    let index = 0;
    editor.change((previous) => {
      const rows = [...previous.sections[key]];
      index = rows.findIndex((row) => row.id === child.id) + 1;
      rows.splice(index, 0, copy);
      return { ...previous, sections: { ...previous.sections, [key]: rows } };
    });
    window.requestAnimationFrame(() => focusField(`sections.${key}.${index}`));
  }
  function errorSection(path: string) {
    const relation = path.match(/^sections\.([^.]*)/);
    if (relation) return schema!.relations[relation[1]]?.group || "main";
    const key = path.match(/^fields\.([^.]+)/)?.[1] || "";
    return propertyKeys.has(key) ? "properties" : schema!.fields.find((field) => field.key === key)?.type === "file" ? "photos" : kind === "articles" ? "blocks" : "main";
  }
  function fieldError(path: string) {
    setSection(errorSection(path));
    const lang = path.match(/\.([a-z]{2})$/)?.[1];
    if (lang) setLanguage(lang);
    else if (path.includes(".fields.") || path.startsWith("fields.")) setLanguage("en");
    window.setTimeout(() => focusField(path), 0);
  }
  function removeChild() {
    if (!remove) return;
    const { key, id: childId } = remove;
    editor.change((previous) => {
      const sections = { ...previous.sections, [key]: previous.sections[key].filter((child) => child.id !== childId) };
      const children = key === "characteristics_blocks" ? "characteristic" : key === "modules_blocks" ? "module_placements" : null;
      if (children) sections[children] = sections[children].map((child) => child.fields.block === childId ? { ...child, fields: { ...child.fields, block: null } } : child);
      return { ...previous, sections };
    });
    setRemove(null);
  }
  const common = { disabled, language, site, root: data, media, upload, errors: editor.fields, compare: compare && language !== "en", addMedia: editor.addMedia, trackUpload: editor.trackUpload };
  const rootSchema = { ...schema, fields: schema.fields.filter((field) => !propertyKeys.has(field.key) && field.type !== "file" && !(field.key === "specs" && ["products", "civil-products"].includes(kind))), relations: {} };
  const propertiesSchema = { ...schema, fields: schema.fields.filter((field) => propertyKeys.has(field.key)), relations: {} };
  const photosSchema = { ...schema, fields: schema.fields.filter((field) => field.type === "file"), relations: {} };
  const previewRelation = relations.find(([key, relation]) => relation.group === contentSection && data.sections[key]?.length);
  const previewFocus = contentSection === "photos" && photosSchema.fields.some((field) => data.fields[field.key]) ? `fields.${photosSchema.fields.find((field) => data.fields[field.key])!.key}` : previewRelation ? `sections.${previewRelation[0]}` : "fields";
  const languageCoverage = (code: string) => contentCoverage(data, schema, code);
  const portalGroup = kind === "portal" ? contentSection === "specs" ? { groups: "characteristics_blocks", items: "characteristic", label: "Specifications" } : contentSection === "modules" ? { groups: "modules_blocks", items: "module_placements", label: "Product modules" } : null : null;
  function renderChild(key: string, relation: NodeSchema, child: ContentNode, index: number, displayIndex = index) {
    return <Collapsible className="cms-content-block" key={child.id} defaultOpen={typeof child.id === "string" || (kind === "articles" && key === "blocks" && index === 0)} title={<div className="cms-block-summary">{mediaURL((child.fields.image || child.fields.icon_file || null) as MediaRef | null, media) && <span className="cms-thumb"><CMSImage compact src={mediaURL((child.fields.image || child.fields.icon_file || null) as MediaRef | null, media)} /></span>}<span><strong>{displayIndex + 1}. {key === "blocks" && nodeTitle(child, language, relation) && <span className="cms-block-kind">{blockTypes[String(child.fields.kind)] || "Block"} · </span>}{nodeTitle(child, language, relation) || (key === "blocks" ? (blockTypes[String(child.fields.kind) as keyof typeof blockTypes] || "Block") : relation.label.toLocaleLowerCase().includes("photo") ? "Photo" : relation.label)}</strong>{blockSummary(child, language) && <small>{blockSummary(child, language)}</small>}</span></div>} invalid={Object.keys(editor.fields).some((path) => path.startsWith(`sections.${key}.${index}.`))} actions={<div className="cms-row-actions cms-block-actions"><button type="button" className="cms-icon" disabled={relationNeighbor(data!.sections[key], index, -1) === undefined} aria-label={`${relation.label} ${displayIndex + 1}: move up`} onClick={() => shift(key, index, -1)}><ArrowUp /></button><button type="button" className="cms-icon" disabled={relationNeighbor(data!.sections[key], index, 1) === undefined} aria-label={`${relation.label} ${displayIndex + 1}: move down`} onClick={() => shift(key, index, 1)}><ArrowDown /></button>{relation.group === "blocks" && !relation.single && <button type="button" className="cms-icon" aria-label={`Duplicate: ${relation.label} ${displayIndex + 1}`} onClick={() => duplicateChild(key, child)}><Copy /></button>}{kind === "articles" && key === "blocks" && <button type="button" className="cms-icon" aria-label={`Add block after ${displayIndex + 1}`} onClick={() => { setInsertAfter(child.id); setAddingBlock(true); }}><Plus /></button>}<button type="button" className="cms-icon cms-danger" aria-label={`Remove: ${relation.label} ${displayIndex + 1}`} onClick={() => setRemove({ key, id: child.id })}><Trash2 /></button></div>}><ContentFields {...common} node={child} schema={relation} path={`sections.${key}.${index}`} update={(value) => updateChild(key, child.id, value)} />{key === "module_placements" && child.fields.module && <div className="cms-notice">This placement belongs to this product. Changes to the shared module affect all linked products.<Link className="cms-button" target="_blank" rel="noreferrer" to={`/${site}/modules/live-${child.fields.module}`}>Edit shared module</Link></div>}</Collapsible>;
  }
  const from = params.get("from") || "";
  return <article className={`cms-editor${kind === "articles" ? " cms-article-editor" : ""}`}><header className="cms-editor-toolbar"><div className="cms-editor-title"><button className="cms-back" onClick={() => { void navigate(`/${site}/${kind}${from ? `?${from}` : ""}`); }}><ArrowLeft />{collectionNames[kind]}</button><div><h1 tabIndex={-1} title={title}>{title}</h1><span className={`cms-status cms-status-${document.status}`}>{statuses[document.status]}</span></div></div></header><div className="cms-editor-actions"><SaveState context={`AI DEF · ${language.toUpperCase()}${session?.environment === "local" ? " · Local" : ""}`} state={editor.state} uploading={editor.uploading} /><button className="cms-button cms-save-button" aria-label="Save draft" aria-keyshortcuts="Control+s Meta+s" title="Save draft · Ctrl/⌘+S" disabled={disabled || !editor.unsaved} onClick={() => { void editor.flush().catch(() => undefined); }}><Save />Save draft</button>{kind !== "modules" && <button className="cms-button" disabled={disabled} onClick={() => { void openPreview(); }}><Eye />Preview</button>}{canPublish && <button className="cms-button cms-primary" disabled={disabled || (document.status === "published" && !editor.unsaved)} onClick={() => setConfirmation("publish")}>Review changes</button>}<MoreActions>{document.target_id !== null && <button disabled={disabled} onClick={() => setWebsiteOpen(true)}>Compare with website</button>}<button disabled={disabled} onClick={() => { void openHistory(); }}><History />Version history</button><button disabled={disabled} onClick={() => { void action("duplicate"); }}>Duplicate</button>{canPublish && document.published_at && kind !== "modules" && <button className="cms-danger" disabled={disabled} onClick={() => setConfirmation("unpublish")}>Unpublish</button>}</MoreActions></div>
    <MaterialNavigation document={document} language={language} prepare={editor.flush} onError={editor.report} disabled={disabled || editor.conflict} />
    {notice && <p className="cms-notice" role="status">{notice}{kind !== "modules" && document.status === "published" && <button className="cms-button" onClick={() => setPreview({ published: true })}>View published version</button>}</p>}
    {editor.error && <div className="cms-editor-errors" role="alert"><strong>{editor.error}</strong>{Object.keys(editor.fields).length > 0 && <span>Errors: {Object.keys(editor.fields).length}</span>}{Object.entries(editor.fields).map(([path, message]) => <button key={path} onClick={() => fieldError(path)}><span>{fieldLabel(path, schema)}: {message}</span><span>Go to field <ArrowRight aria-hidden="true" /></span></button>)}{editor.conflict && <div className="cms-row-actions"><button className="cms-button" disabled={disabled} onClick={() => { void action("duplicate"); }}>Save my work as a copy</button><button className="cms-button" onClick={() => setConfirmation("reload")}>Open latest version</button></div>}</div>}
    <div className="cms-editor-layout"><nav className="cms-section-nav" aria-label="Content sections">{["properties", ...availableGroups.filter((group) => group !== "properties")].map((group) => <button key={group} className={group === "properties" ? "cms-property-tab" : undefined} aria-current={section === group ? "page" : undefined} onClick={() => setSection(group)}>{kind === "articles" && group === "blocks" ? "Article text" : groups[group]}{Object.keys(editor.fields).some((path) => errorSection(path) === group) && <span className="cms-tab-error" role="img" aria-label="Contains errors">!</span>}</button>)}</nav>
      <div className="cms-editor-content"><LanguageBar site={site} language={language} onLanguage={setLanguage} compare={compare} onCompare={setCompare} coverage={languageCoverage} />
      <SectionGuide kind={kind} section={section} />
      <TranslationChecklist language={language} tasks={contentMissing(data, schema, language)} onField={(path) => { setCompare(true); fieldError(path); }}><TranslationReview key={language} document={document} language={language} prepare={editor.flush} onReviewed={editor.replace} onReload={editor.reload} label={(path) => fieldLabel(path, schema)} onField={(path) => { setCompare(true); fieldError(path); }} unsaved={editor.unsaved} disabled={disabled || editor.conflict} /></TranslationChecklist>
      {document.target_id === null && kind !== "modules" && <DraftGuide kind={kind} section={section} onSection={setSection} onReview={canPublish ? () => setConfirmation("publish") : undefined} />}
      {!canPublish && <p className="cms-notice">You can prepare drafts. A publisher must publish changes to the website.</p>}
      <div className={`cms-form-grid${section === "properties" ? " is-properties" : ""}`}><fieldset className="cms-editor-fields cms-form-main" disabled={disabled}>
        {(contentSection === "main" || (contentSection === "blocks" && kind === "articles")) && <section className="cms-panel">{kind === "articles" ? <Collapsible className="cms-editor-details" invalid={Object.keys(editor.fields).some((path) => path.startsWith("fields.") && !propertyKeys.has(path.split(".")[1]))} title="Title and summary"><ContentFields {...common} node={data} schema={rootSchema} path="" update={(value) => editor.change(() => value)} /></Collapsible> : <><h2>General</h2><ContentFields {...common} node={data} schema={rootSchema} path="" update={(value) => editor.change(() => value)} /></>}</section>}
        {contentSection === "photos" && photosSchema.fields.length > 0 && <section className="cms-panel"><h2>Content images</h2><ContentFields {...common} node={data} schema={photosSchema} path="" update={(value) => editor.change(() => value)} /></section>}
        {relations.filter(([key, relation]) => relation.group === contentSection && (!portalGroup || ![portalGroup.groups, portalGroup.items].includes(key))).map(([key, relation]) => <section className="cms-panel cms-content-section" key={key}><div className="cms-panel-heading"><div><h2>{relation.label}</h2>{key === "sections" && <p className="cms-muted">Legacy content has been preserved. New article blocks take precedence on the website.</p>}</div>{(!relation.single || !data.sections[key]?.length) && <button type="button" className="cms-button" onClick={() => { if (kind === "articles" && key === "blocks") { setInsertAfter(null); setAddingBlock(true); } else addChild(key, relation); }}><Plus />Add {key === "blocks" ? "block" : "item"}</button>}</div>
          {(data.sections[key] || []).map((child, index) => renderChild(key, relation, child, index))}
          {!data.sections[key]?.length && <p className="cms-muted">This section is empty.</p>}
        </section>)}
        {portalGroup && <section className="cms-panel cms-content-section"><div className="cms-panel-heading"><div><h2>{portalGroup.label}</h2><p className="cms-muted">Content is organised into groups. Ungrouped items are shown separately.</p></div><button type="button" className="cms-button" onClick={() => addChild(portalGroup.groups, schema.relations[portalGroup.groups])}><Plus />Add group</button></div>{[...(data.sections[portalGroup.groups] || []), null].map((group) => {
          const entries = (data.sections[portalGroup.items] || []).map((child, index) => ({ child, index })).filter(({ child }) => group ? child.fields.block === group.id : !(data.sections[portalGroup.groups] || []).some((candidate) => candidate.id === child.fields.block));
          const items = <>{entries.map(({ child, index }, order) => renderChild(portalGroup.items, schema.relations[portalGroup.items], child, index, order))}<button type="button" className="cms-button cms-content-section" onClick={() => addChild(portalGroup.items, schema.relations[portalGroup.items], undefined, group?.id ?? null)}><Plus />{portalGroup.items === "characteristic" ? "Add specification" : "Add module"}</button></>;
          return group ? <Collapsible key={group.id} className="cms-content-block cms-portal-group" defaultOpen title={<strong>{nodeTitle(group, language) || "New group"} · {entries.length}</strong>} invalid={Object.keys(editor.fields).some((path) => path.startsWith(`sections.${portalGroup.groups}.${data.sections[portalGroup.groups].indexOf(group)}.`))} actions={<div className="cms-row-actions cms-block-actions"><button type="button" className="cms-icon" aria-label="Move group up" disabled={relationNeighbor(data.sections[portalGroup.groups], data.sections[portalGroup.groups].indexOf(group), -1) === undefined} onClick={() => shift(portalGroup.groups, data.sections[portalGroup.groups].indexOf(group), -1)}><ArrowUp /></button><button type="button" className="cms-icon" aria-label="Move group down" disabled={relationNeighbor(data.sections[portalGroup.groups], data.sections[portalGroup.groups].indexOf(group), 1) === undefined} onClick={() => shift(portalGroup.groups, data.sections[portalGroup.groups].indexOf(group), 1)}><ArrowDown /></button><button type="button" className="cms-button cms-danger" onClick={() => setRemove({ key: portalGroup.groups, id: group.id })}>Remove group</button></div>}><ContentFields {...common} node={group} schema={schema.relations[portalGroup.groups]} path={`sections.${portalGroup.groups}.${data.sections[portalGroup.groups].indexOf(group)}`} update={(value) => updateChild(portalGroup.groups, group.id, value)} />{items}</Collapsible> : <section key="ungrouped" className="cms-content-section"><h3>Ungrouped · {entries.length}</h3>{items}</section>;
        })}</section>}
      </fieldset><aside className="cms-properties"><fieldset className="cms-editor-fields" disabled={disabled}><section className="cms-panel">{mediaURL((data.fields.hero_image || data.sections.images?.[0]?.fields.image || null) as MediaRef | null, media) && <CMSImage className="cms-context-cover" src={mediaURL((data.fields.hero_image || data.sections.images?.[0]?.fields.image || null) as MediaRef | null, media)} />}{propertiesSchema.fields.length > 0 && <h2>Content properties</h2>}<ContentFields {...common} node={data} schema={propertiesSchema} path="" update={(value) => editor.change(() => value)} /><TranslationSummary site={site} reviews={document.translation_review} unsaved={editor.unsaved} coverage={languageCoverage} onLanguage={setLanguage} /><p className="cms-context">Draft updated: {dateTime(document.updated_at)}</p>{document.published_at && <p className="cms-context">Published: {dateTime(document.published_at)}</p>}</section></fieldset></aside></div></div></div>
    <Modal open={addingBlock} onClose={() => setAddingBlock(false)} title="Add article block" description="Select a content type. You can change the order and text in the draft."><div className="cms-block-types">{Object.entries(blockTypes).map(([key, label]) => <button type="button" className="cms-button" key={key} onClick={() => addChild("blocks", schema.relations.blocks, key)}><Plus aria-hidden="true" />{label}</button>)}</div></Modal>
    {confirmation === "publish" && <PublishReview onWebsite={document.target_id !== null ? () => { setConfirmation(null); setWebsiteOpen(true); } : undefined} onError={editor.report} site={site} kind={kind} title={title} prepare={editor.flush} busy={Boolean(busy)} onClose={() => setConfirmation(null)} label={(path) => fieldLabel(path, schema)} onField={(path, fields) => { if (fields) editor.report(new APIError("Fix before publishing.", 422, fields)); fieldError(path); }} onPublish={(version) => { void action("publish", { version }); }} />}
    <Modal preventDismiss={Boolean(busy)} open={confirmation === "unpublish"} onClose={() => setConfirmation(null)} title="Unpublish content?" description="The content will be removed from the website and retained in CMS."><footer><button className="cms-button" onClick={() => setConfirmation(null)}>Cancel</button><button className="cms-button cms-danger" disabled={disabled} onClick={() => { void action("unpublish"); }}>Unpublish</button></footer></Modal>
    {websiteOpen && <WebsiteComparison site={site} prepare={editor.flush} label={(path) => fieldLabel(path, schema)} onClose={() => setWebsiteOpen(false)} onResolved={(value) => { editor.replace(value); setNotice("Your draft was preserved in Version history. The current website version is now open. Nothing was published."); }} />}
    <Modal open={confirmation === "reload"} onClose={() => setConfirmation(null)} title="Replace my version with the latest?" description="Unsaved form changes will be replaced. Create a copy first to keep them."><footer><button className="cms-button" onClick={() => setConfirmation(null)}>Stay</button><button className="cms-button" onClick={() => { editor.reload(); setConfirmation(null); }}>Replace</button></footer></Modal>
    <Modal open={remove !== null} onClose={() => setRemove(null)} title={`Remove “${remove ? nodeTitle(data.sections[remove.key]?.find((item) => item.id === remove.id) || data, language, schema.relations[remove.key]) || schema.relations[remove.key]?.label : "item"}”?`} description={remove && ["characteristics_blocks", "modules_blocks"].includes(remove.key) ? "The group will be removed from the draft; its items will remain ungrouped. The website changes only after publication." : "This change will be saved to the draft. The item stays on the website until publication."}><footer><button className="cms-button" onClick={() => setRemove(null)}>Cancel</button><button className="cms-button cms-danger" onClick={removeChild}>Remove</button></footer></Modal>
    <Modal className="cms-history-modal" open={history !== null} onClose={() => setHistory(null)} title="Version history" description="Select a version to preview or restore as a draft."><div className="cms-history-body">{editor.error && <ErrorMessage message={editor.error} />}{comparisonVersion !== null && <HistoryChanges site={site} version={comparisonVersion} prepare={editor.flush} disabled={disabled} onRestore={() => { void action("restore", { restore_version: comparisonVersion }); }} label={(path) => fieldLabel(path, schema)} onClose={() => setComparisonVersion(null)} />}<div className="cms-history">{history?.map((revision) => <div key={revision.version}><div><strong>{revisionTitle(revision.action)}</strong><small>Version {revision.version} · {dateTime(revision.created_at)} · {revision.author}</small></div><div className="cms-row-actions"><button className="cms-button" disabled={disabled} aria-pressed={comparisonVersion === revision.version} onClick={() => setComparisonVersion(revision.version)}>Compare changes</button>{kind !== "modules" && <button className="cms-button" disabled={disabled} onClick={() => { void openPreview(revision.version); }}>Preview</button>}<RestoreButton version={revision.version} disabled={disabled} onRestore={() => { void action("restore", { restore_version: revision.version }); }} /></div></div>)}</div>{historyMore && <button className="cms-button" onClick={() => { void openHistory(history?.at(-1)?.version); }}>Earlier versions</button>}</div></Modal>
    <PreviewSurface open={preview !== null} onClose={() => setPreview(null)} title={preview?.published ? "Published version" : preview?.revision ? `Preview · version ${preview.revision}` : "Draft preview"} description={`${title} · AI DEF · ai-def.com`}><div className="cms-preview-tools"><label>Language<Select value={language} onValueChange={(selectedValue) => setLanguage(selectedValue)}>{languages.filter(([code]) => code !== "ru").map(([code, label]) => <option value={code} key={code}>{label}</option>)}</Select></label><div><button className="cms-button" aria-pressed={!mobile} onClick={() => setMobile(false)}>Desktop</button><button className="cms-button" aria-pressed={mobile} onClick={() => setMobile(true)}>Phone</button></div></div>{preview && <PreviewFrame currentVersion={document.version} unsaved={editor.unsaved} refresh={editor.flush} focusPath={preview.revision || preview.published ? undefined : previewFocus} onField={preview.revision || preview.published ? undefined : (path) => { if (!window.matchMedia("(min-width:1600px)").matches) setPreview(null); window.setTimeout(() => fieldError(path), 0); }} mobile={mobile} title="Page preview" src={`/cms/${site}/preview/${document.id}/${language}?${new URLSearchParams({ kind, ...(preview.revision ? { revision: String(preview.revision) } : {}), ...(preview.published ? { published: "1" } : {}) })}`} />}</PreviewSurface>
    <Modal open={editor.blocker.state === "blocked" && editor.state === "error"} onClose={() => { if (editor.blocker.state === "blocked") editor.blocker.reset(); }} title="Unable to save changes" description="Your changes remain in the form. Stay and try saving again."><footer><button className="cms-button cms-primary" onClick={() => { if (editor.blocker.state === "blocked") editor.blocker.reset(); }}>Stay</button><button className="cms-button cms-danger" onClick={() => { if (editor.blocker.state === "blocked") editor.blocker.proceed(); }}>Leave without saving</button></footer></Modal>
  </article>;
}
