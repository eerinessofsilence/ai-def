import Collapsible from "../../components/ui/collapsible";
import Select from "../../components/ui/select";
import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Eye, History, ImagePlus, Plus, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, APIError, categories, dateTime, languages, mediaURL, statuses, revisionTitle } from "./api";
import type { ArmsVariant, CMSDocument, MediaRef, Revision, Specification, Translation } from "./api";
import { useSession } from "./session";
import { ErrorMessage, focusField, Loading, Modal, MoreActions, PreviewFrame, PreviewSurface, RestoreButton, SaveState, RemoveButton } from "./ui";
import { useDocument } from "./use-document";
import { useEditorNavigation } from "./use-editor-navigation";
import LanguageBar, { TranslationSummary } from "./LanguageBar";
import TranslationField from "./TranslationField";
import { armsCoverage, armsMissing } from "./translations";
import MediaPicker from "./MediaPicker";
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

const sections = [["properties", "Properties"], ["main", "General"], ["photos", "Images"], ["specs", "Specifications"], ["variants", "Variants"]];

function move<T>(items: T[], index: number, direction: number): T[] {
  const result = [...items];
  if (index + direction < 0 || index + direction >= result.length) return result;
  [result[index], result[index + direction]] = [result[index + direction], result[index]];
  return result;
}

function fieldMessage(errors: Record<string, string>, path: string) {
  return errors[path] && <small className="cms-field-error" id={`${path}-error`}>{errors[path]}</small>;
}
function errorLabel(path: string) {
  const labels: Record<string, string> = { name: "Product name", brand: "Manufacturer", category: "Category", slug: "Page URL", cover: "Cover", width: "Cover width", height: "Cover height", variants: "Variant", images: "Photo", media: "File", alt: "Image description", content: "Translation", description: "Description", cover_alt: "Cover description", specifications: "Specification", label: "Name", value: "Value", code: "Variant code", model_name: "Model name" };
  return path.split(".").map((part) => labels[part] || (/^\d+$/.test(part) ? String(Number(part) + 1) : part.toUpperCase())).join(" · ");
}
function fieldAttributes(errors: Record<string, string>, path: string) {
  return { "aria-invalid": Boolean(errors[path]), "aria-describedby": errors[path] ? `${path}-error` : undefined };
}
function Specifications({ value, onChange, prefix, errors }: { value: Specification[]; onChange: (value: Specification[]) => void; prefix: string; errors: Record<string, string> }) {
  return <div className="cms-specs" id={prefix} tabIndex={-1}>{value.length > 0 && <p className="cms-muted">Enter a name and value for every added specification before publishing.</p>}{value.map((row, index) => <div className="cms-spec-row" key={index} id={`${prefix}.${index}`} tabIndex={-1}>
    <label><span className="cms-sr">Specification name {index + 1}</span><input id={`${prefix}.${index}.label`} maxLength={1000} {...fieldAttributes(errors, `${prefix}.${index}.label`)} value={row.label} placeholder="For example, material" onChange={(event) => onChange(value.map((item, position) => position === index ? { ...item, label: event.target.value } : item))} />{fieldMessage(errors, `${prefix}.${index}.label`)}</label>
    <label><span className="cms-sr">Specification value {index + 1}</span><input id={`${prefix}.${index}.value`} maxLength={1000} {...fieldAttributes(errors, `${prefix}.${index}.value`)} value={row.value} placeholder="Value" onChange={(event) => onChange(value.map((item, position) => position === index ? { ...item, value: event.target.value } : item))} />{fieldMessage(errors, `${prefix}.${index}.value`)}</label>
    <div className="cms-row-actions"><button type="button" className="cms-icon" disabled={!index} aria-label={`Specification ${index + 1}: move up`} onClick={() => { onChange(move(value, index, -1)); requestAnimationFrame(() => focusField(`${prefix}.${index - 1}.label`)); }}><ArrowUp /></button><button type="button" className="cms-icon" disabled={index === value.length - 1} aria-label={`Specification ${index + 1}: move down`} onClick={() => { onChange(move(value, index, 1)); requestAnimationFrame(() => focusField(`${prefix}.${index + 1}.label`)); }}><ArrowDown /></button><button type="button" className="cms-icon cms-danger" aria-label={`Delete specification ${index + 1}`} onClick={() => onChange(value.filter((_, position) => position !== index))}><Trash2 /></button></div>
  </div>)}<button type="button" className="cms-button" onClick={() => onChange([...value, { label: "", value: "" }])}><Plus />Add specification</button>{!value.length && <p className="cms-muted">Only add specifications that should appear on the website.</p>}</div>;
}

export default function ArmsEditorRoute() {
  const { site = "arms", id = "" } = useParams();
  return <ArmsEditor key={`${site}:${id}`} site={site} id={id} />;
}

function ArmsEditor({ site, id }: { site: string; id: string }) {
  const editor = useDocument(site, id);
  const { document, data, media } = editor;
  const { session } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { section: requestedSection, setSection, language, setLanguage } = useEditorNavigation(site, "main", Boolean(data));
  const section = sections.some(([key]) => key === requestedSection) ? requestedSection : "main";
  const contentSection = section === "properties" ? "main" : section;
  const [compare, setCompare] = useState(false);
  const [variantId, setVariantId] = useState<number | string | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [history, setHistory] = useState<Revision[] | null>(null);
  const [historyMore, setHistoryMore] = useState(false);
  const [comparisonVersion, setComparisonVersion] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ revision?: number; published?: boolean } | null>(null);
  const [mobilePreview, setMobilePreview] = useState(() => window.matchMedia("(max-width:600px)").matches);
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | "reload" | null>(null);
  const [deleteVariant, setDeleteVariant] = useState<number | string | null>(null);
  const role = session?.sites.find((item) => item.id === site)?.role;
  const canPublish = role === "manager" || role === "publisher";
  const url = document ? `${site}/documents/${document.id}/` : "";

  async function action(name: string, extra: Record<string, unknown> = {}) {
    setBusy(name); setNotice("");
    try {
      const latest = name === "duplicate" ? document : await editor.flush();
      if (!latest) return;
      const result = await api<CMSDocument>(`${site}/documents/${latest.id}/${name}/`, { method: "POST", body: JSON.stringify({ version: latest.version, ...(name === "duplicate" ? { data } : {}), ...extra }) });
      editor.replace(result);
      setNotice(name === "publish" ? session?.environment === "local" ? "Published to the local copy. Public websites are unchanged." : "Product published on arms.ai-def.com." : name === "unpublish" ? "Product unpublished." : name === "restore" ? "Version restored as a draft. Publish to update the website." : "");
      if (name === "duplicate") await navigate(`/${site}/products/${result.id}`);
      setConfirm(null); setHistory(null);
    } catch (failure) { setConfirm(null); editor.report(failure); }
    finally { setBusy(""); }
  }

  async function showPreview(revision?: number) {
    setBusy("preview");
    try { await editor.flush(); setPreview({ revision }); setHistory(null); }
    catch (failure) { editor.report(failure); }
    finally { setBusy(""); }
  }

  async function showHistory(before?: number) {
    if (!before) setComparisonVersion(null);
    setBusy("history");
    try {
      const result = await api<{ items: Revision[] }>(url + "history/" + (before ? `?before=${before}` : ""));
      setHistory((previous) => before ? [...(previous || []), ...result.items] : result.items);
      setHistoryMore(result.items.length === 30);
    } catch (failure) { editor.report(failure); }
    finally { setBusy(""); }
  }

  function productText(key: keyof Translation, value: string | Specification[]) {
    editor.change((previous) => ({ ...previous, content: { ...previous.content, [language]: { ...previous.content[language], specifications: previous.content[language]?.specifications || [], [key]: value } } }));
  }
  function updateVariant(selected: number | string, update: (value: ArmsVariant) => ArmsVariant) {
    editor.change((previous) => ({ ...previous, variants: previous.variants.map((variant) => variant.id === selected ? update(variant) : variant) }));
  }
  function addVariant() {
    const identifier = crypto.randomUUID();
    const variant: ArmsVariant = { id: identifier, code: "variant-" + identifier.slice(0, 8), model_name: "", content: {}, images: [] };
    editor.change((previous) => ({ ...previous, variants: [...previous.variants, variant] }));
    setVariantId(identifier); setSection("variants");
    window.setTimeout(() => focusField(`variants.${data?.variants.length || 0}.content.${language}.label`), 0);
  }
  function upload(file: File | undefined) {
    if (!file) return;
    const problem = uploadError(file, "image");
    if (problem) { editor.report(new Error(problem)); return; }
    const form = new FormData(); form.append("file", file);
    const task = api<{ ref: MediaRef; url: string; width: number; height: number }>(`${site}/uploads/`, { method: "POST", body: form }).then((uploaded) => {
      if ("asset_id" in uploaded.ref) editor.addMedia(uploaded.ref.asset_id, uploaded.url);
      editor.change((previous) => ({ ...previous, cover: uploaded.ref, width: uploaded.width, height: uploaded.height }));
    });
    editor.trackUpload(task);
    void task.catch(editor.report);
  }

  function errorSection(path: string) {
    if (path.startsWith("variants")) return "variants";
    if (["cover", "width", "height"].includes(path) || path.endsWith(".cover_alt")) return "photos";
    if (path.includes("specifications")) return "specs";
    return ["brand", "category", "slug"].includes(path) ? "properties" : "main";
  }
  function goToField(path: string) {
    const matchLanguage = path.match(/(?:content|alt)\.([a-z]{2})(?:\.|$)/)?.[1];
    if (matchLanguage) setLanguage(matchLanguage);
    if (path.startsWith("variants")) {
      setSection("variants");
      const index = Number(path.split(".")[1]);
      if (data?.variants[index]) setVariantId(data.variants[index].id);
    } else if (["cover", "width", "height"].includes(path) || path.endsWith(".cover_alt")) setSection("photos");
    else if (path.includes("specifications")) setSection("specs");
    else setSection(["brand", "category", "slug"].includes(path) ? "properties" : "main");
    window.setTimeout(() => focusField(["width", "height"].includes(path) ? "cover" : path), 0);
  }

  if (!data || !document) return editor.error ? <section className="cms-page"><ErrorMessage message={editor.error} retry={editor.reload} /></section> : <Loading />;
  const translation = data.content[language] || { specifications: [] };
  const variant = data.variants.find((item) => item.id === variantId) || data.variants[0];
  const variantIndex = variant ? data.variants.indexOf(variant) : -1;
  const variantTranslation = variant?.content[language] || { specifications: [] };
  const cover = mediaURL(data.cover, media);
  const disabled = Boolean(busy) || editor.uploading > 0;
  const languageCoverage = (code: string) => armsCoverage(data, code);
  const from = params.get("from") || "";
  const previewFocus = section === "photos" ? "cover" : section === "variants" ? `variants.${Math.max(0, variantIndex)}` : section === "specs" ? `content.${language}.specifications` : `content.${language}.description`;
  function variantText(key: keyof Translation, value: string | Specification[]) {
    if (variant) updateVariant(variant.id, (item) => ({ ...item, content: { ...item.content, [language]: { ...item.content[language], specifications: item.content[language]?.specifications || [], [key]: value } } }));
  }

  return <article className="cms-editor">
    <header className="cms-editor-toolbar"><div className="cms-editor-title"><button className="cms-back" onClick={() => { void navigate(`/${site}/products${from ? `?${from}` : ""}`); }}><ArrowLeft />Products</button><div><h1 tabIndex={-1} title={data.name}>{data.name || "New product"}</h1><span className={`cms-status cms-status-${document.status}`}>{statuses[document.status]}</span></div></div></header><div className="cms-editor-actions"><SaveState context={`ARMS · ${language.toUpperCase()}${session?.environment === "local" ? " · Local" : ""}`} state={editor.state} uploading={editor.uploading} /><button className="cms-button cms-save-button" disabled={disabled || !editor.unsaved} onClick={() => { void editor.flush().catch(() => undefined); }} aria-label="Save draft" aria-keyshortcuts="Control+s Meta+s" title="Save draft · Ctrl/⌘+S"><Save />Save draft</button><button className="cms-button" disabled={disabled} onClick={() => { void showPreview(); }}><Eye />Preview</button>{canPublish && <button className="cms-button cms-primary" disabled={disabled || (document.status === "published" && !editor.unsaved)} onClick={() => setConfirm("publish")}>Review changes</button>}<MoreActions>{document.target_id !== null && <button disabled={disabled} onClick={() => setWebsiteOpen(true)}>Compare with website</button>}<button disabled={disabled} onClick={() => { void showHistory(); }}><History />Version history</button><button disabled={disabled} onClick={() => { void action("duplicate"); }}><Copy />Duplicate</button>{canPublish && document.published_at && <button className="cms-danger" disabled={disabled} onClick={() => setConfirm("unpublish")}>Unpublish</button>}</MoreActions></div>
    <MaterialNavigation document={document} language={language} prepare={editor.flush} onError={editor.report} disabled={disabled || editor.conflict} />
    {notice && <p className="cms-notice" role="status">{notice}{document.status === "published" && <button className="cms-button" onClick={() => setPreview({ published: true })}>View published version</button>}</p>}
    {editor.error && <div className="cms-editor-errors" role="alert"><strong>{editor.error}</strong>{Object.entries(editor.fields).map(([path, message]) => <button key={path} onClick={() => goToField(path)}><span>{errorLabel(path)}: {message}</span><span>Go to field <ArrowRight aria-hidden="true" /></span></button>)}{editor.conflict && <div className="cms-row-actions"><button className="cms-button" disabled={disabled} onClick={() => { void action("duplicate"); }}>Save my work as a copy</button><button className="cms-button" onClick={() => setConfirm("reload")}>Open latest version</button></div>}</div>}
    <div className="cms-editor-layout"><nav className="cms-section-nav" aria-label="Product sections">{sections.map(([key, label]) => <button key={key} className={key === "properties" ? "cms-property-tab" : undefined} aria-current={section === key ? "page" : undefined} onClick={() => setSection(key)}>{label}{key === "variants" && <span>{data.variants.length}</span>}{Object.keys(editor.fields).some((path) => errorSection(path) === key) && <span className="cms-tab-error" role="img" aria-label="Contains errors">!</span>}</button>)}</nav>
      <div className="cms-editor-content"><LanguageBar site={site} language={language} onLanguage={setLanguage} compare={compare} onCompare={setCompare} coverage={languageCoverage} />
      <SectionGuide kind="products" section={section} />
      <TranslationChecklist language={language} tasks={armsMissing(data, language).map((path) => ({ path, label: errorLabel(path), missing: 1 }))} onField={(path) => { setCompare(true); goToField(path); }}><TranslationReview key={language} document={document} language={language} prepare={editor.flush} onReviewed={editor.replace} onReload={editor.reload} label={errorLabel} onField={(path) => { setCompare(true); goToField(path); }} unsaved={editor.unsaved} disabled={disabled || editor.conflict} /></TranslationChecklist>
      {document.target_id === null && <DraftGuide kind="arms" section={section} onSection={setSection} onReview={canPublish ? () => setConfirm("publish") : undefined} />}
        {!canPublish && <p className="cms-notice">You can prepare drafts. A publisher must publish changes to the website.</p>}
        <div className={`cms-form-grid${section === "properties" ? " is-properties" : ""}`}><fieldset className="cms-editor-fields cms-form-main" disabled={disabled}>
        {contentSection === "main" && <section className="cms-panel"><h2>General</h2><p className="cms-muted">The name is shared across languages. The description is saved for the selected language.</p><label className="cms-field"><span>Product name <small className="cms-required">Required to publish</small></span><input id="name" {...fieldAttributes(editor.fields, "name")} value={data.name} maxLength={255} onChange={(event) => editor.change((previous) => ({ ...previous, name: event.target.value }))} />{fieldMessage(editor.fields, "name")}</label><TranslationField compare={compare && language !== "en"} original={data.content.en?.description} value={translation.description} label="Product description" onCopy={() => productText("description", data.content.en?.description || "")}><label className="cms-field"><span>Description · {language.toUpperCase()} <small className="cms-required">Required to publish · EN</small></span><textarea id={`content.${language}.description`} maxLength={30000} {...fieldAttributes(editor.fields, `content.${language}.description`)} rows={5} value={translation.description || ""} onChange={(event) => productText("description", event.target.value)} />{fieldMessage(editor.fields, `content.${language}.description`)}</label></TranslationField><div className="cms-content-section cms-row-actions"><button type="button" className="cms-button" onClick={() => setSection("photos")}>Cover: {data.cover ? "added" : "not selected"}</button><button type="button" className="cms-button" onClick={() => setSection("variants")}>Variants · {data.variants.length}</button></div></section>}
        {contentSection === "photos" && <section className="cms-panel"><h2>Product cover</h2><p className="cms-required">Required to publish.</p><p className="cms-muted">Used in the catalogue. Variant photos are managed under Variants.</p><div className="cms-cover">{cover ? <CMSImage src={cover} alt="Product cover" /> : <ImagePlus aria-hidden="true" />}</div><div className="cms-row-actions"><MediaPicker site={site} currentURL={cover} context={`Product cover · ${data.name}`} label="Choose from library" trackUpload={editor.trackUpload} onChoose={([asset]) => { editor.addMedia(asset.ref.asset_id, asset.url); editor.change((previous) => ({ ...previous, cover: asset.ref, width: asset.width || 0, height: asset.height || 0 })); }} /><label className="cms-button cms-file"><ImagePlus />{cover ? "Replace cover" : "Upload cover"}<input id="cover" {...fieldAttributes(editor.fields, "cover")} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload cover" disabled={disabled} onChange={(event) => { upload(event.target.files?.[0]); event.target.value = ""; }} />{fieldMessage(editor.fields, "cover")}</label>{cover && <RemoveButton label="product cover" disabled={disabled} onRemove={() => editor.change((previous) => ({ ...previous, cover: null }))} />}</div><p className="cms-muted">JPEG, PNG or WebP: up to 20 MiB and 40 megapixels. Image proportions are preserved.</p><TranslationField compare={compare && language !== "en"} original={data.content.en?.cover_alt} value={translation.cover_alt} label="Cover description" onCopy={() => productText("cover_alt", data.content.en?.cover_alt || "")}><label className="cms-field"><span>Image description · {language.toUpperCase()}</span><input id={`content.${language}.cover_alt`} {...fieldAttributes(editor.fields, `content.${language}.cover_alt`)} value={translation.cover_alt || ""} onChange={(event) => productText("cover_alt", event.target.value)}  maxLength={255}/>{fieldMessage(editor.fields, `content.${language}.cover_alt`)}<small>Briefly describe the image for people using a screen reader.</small></label></TranslationField></section>}
        {contentSection === "specs" && <section className="cms-panel"><h2>Shared specifications · {language.toUpperCase()}</h2><p className="cms-muted">Shown for all variants. Add variant-specific differences within each variant.</p><TranslationField compare={compare && language !== "en"} original={data.content.en?.specifications} value={translation.specifications} label="Shared specifications" onCopy={() => productText("specifications", structuredClone(data.content.en?.specifications || []))}><Specifications errors={editor.fields} prefix={`content.${language}.specifications`} value={translation.specifications || []} onChange={(value) => productText("specifications", value)} /></TranslationField></section>}
        {contentSection === "variants" && <section className="cms-panel" id="variants" tabIndex={-1}><div className="cms-panel-heading"><div><h2>Product variants</h2><p className="cms-muted">To publish, add at least one variant with an English name, a unique code and a photo.</p></div><button type="button" className="cms-button" onClick={addVariant}><Plus />Add variant</button></div>{data.variants.length ? <><div className="cms-variant-list">{data.variants.map((item) => <button type="button" key={item.id} aria-pressed={variant?.id === item.id} onClick={() => setVariantId(item.id)}>{item.content[language]?.label || item.content.en?.label || "New variant"}<small>{item.code} · {item.images.length} photos</small></button>)}</div>{variant && <div className="cms-variant-form" key={variant.id} id={`variants.${variantIndex}`} tabIndex={-1}><div className="cms-panel-heading"><h3>{variant.content[language]?.label || variant.content.en?.label || "New variant"}</h3><div className="cms-row-actions"><button type="button" className="cms-icon" aria-label="Move variant up" disabled={variantIndex === 0} onClick={() => { editor.change((previous) => ({ ...previous, variants: move(previous.variants, variantIndex, -1) })); requestAnimationFrame(() => focusField(`variants.${variantIndex - 1}.content.${language}.label`)); }}><ArrowUp /></button><button type="button" className="cms-icon" aria-label="Move variant down" disabled={variantIndex === data.variants.length - 1} onClick={() => { editor.change((previous) => ({ ...previous, variants: move(previous.variants, variantIndex, 1) })); requestAnimationFrame(() => focusField(`variants.${variantIndex + 1}.content.${language}.label`)); }}><ArrowDown /></button><button type="button" className="cms-icon cms-danger" aria-label="Delete variant" onClick={() => setDeleteVariant(variant.id)}><Trash2 /></button></div></div><TranslationField compare={compare && language !== "en"} original={variant.content.en?.label} value={variantTranslation.label} label="Variant name" onCopy={() => variantText("label", variant.content.en?.label || "")}><label className="cms-field"><span>Variant name · {language.toUpperCase()} <small className="cms-required">Required to publish · EN</small></span><input id={`variants.${variantIndex}.content.${language}.label`} {...fieldAttributes(editor.fields, `variants.${variantIndex}.content.${language}.label`)} value={variantTranslation.label || ""} onChange={(event) => variantText("label", event.target.value)}  maxLength={255}/>{fieldMessage(editor.fields, `variants.${variantIndex}.content.${language}.label`)}</label></TranslationField>{language !== "en" && !variantTranslation.label && <p className="cms-muted">The website uses the English name: {variant.content.en?.label || "not filled in"}.</p>}<label className="cms-field"><span>Model name <small>Shared across languages</small></span><input id={`variants.${variantIndex}.model_name`} {...fieldAttributes(editor.fields, `variants.${variantIndex}.model_name`)} value={variant.model_name} placeholder={data.name} onChange={(event) => updateVariant(variant.id, (item) => ({ ...item, model_name: event.target.value }))}  maxLength={255}/>{fieldMessage(editor.fields, `variants.${variantIndex}.model_name`)}</label><h3>Photos</h3><div className="cms-photo-grid" id={`variants.${variantIndex}.images`} tabIndex={-1}>{variant.images.map((photo, index) => <div className="cms-photo" key={photo.id} id={`variants.${variantIndex}.images.${index}`} tabIndex={-1}><CMSImage src={mediaURL(photo.media, media)} alt={`Photo ${index + 1}`} /><TranslationField compare={compare && language !== "en"} original={photo.alt?.en} value={photo.alt?.[language]} label="Photo description" onCopy={() => updateVariant(variant.id, (item) => ({ ...item, images: item.images.map((image) => image.id === photo.id ? { ...image, alt: { ...image.alt, [language]: photo.alt?.en || "" } } : image) }))}><label className="cms-photo-alt"><span>Description · {language.toUpperCase()}</span><input id={`variants.${variantIndex}.images.${index}.alt.${language}`} {...fieldAttributes(editor.fields, `variants.${variantIndex}.images.${index}.alt.${language}`)} aria-label={`Photo description ${index + 1} · ${language.toUpperCase()}`} maxLength={255} value={photo.alt?.[language] || ""} onChange={(event) => updateVariant(variant.id, (item) => ({ ...item, images: item.images.map((image) => image.id === photo.id ? { ...image, alt: { ...image.alt, [language]: event.target.value } } : image) }))} />{fieldMessage(editor.fields, `variants.${variantIndex}.images.${index}.alt.${language}`)}</label></TranslationField><div className="cms-row-actions"><MediaPicker site={site} label="Replace" context={`Replace photo ${index + 1} · ${variant.content.en?.label || variant.code}`} currentURL={mediaURL(photo.media, media)} trackUpload={editor.trackUpload} onChoose={([asset]) => { editor.addMedia(asset.ref.asset_id, asset.url); updateVariant(variant.id, (item) => ({ ...item, images: item.images.map((image) => image.id === photo.id ? { ...image, media: asset.ref } : image) })); }} /><button type="button" className="cms-icon" aria-label={`Photo ${index + 1}: move up`} disabled={!index} onClick={() => { updateVariant(variant.id, (item) => ({ ...item, images: move(item.images, index, -1) })); requestAnimationFrame(() => focusField(`variants.${variantIndex}.images.${index - 1}.alt.${language}`)); }}><ArrowUp /></button><button type="button" className="cms-icon" aria-label={`Photo ${index + 1}: move down`} disabled={index === variant.images.length - 1} onClick={() => { updateVariant(variant.id, (item) => ({ ...item, images: move(item.images, index, 1) })); requestAnimationFrame(() => focusField(`variants.${variantIndex}.images.${index + 1}.alt.${language}`)); }}><ArrowDown /></button><RemoveButton icon label={`photo ${index + 1}`} disabled={disabled} onRemove={() => updateVariant(variant.id, (item) => ({ ...item, images: item.images.filter((_, position) => position !== index) }))} /></div></div>)}</div><MediaPicker site={site} multiple label="Add photos" context={`Add photos · ${variant.content.en?.label || variant.code}`} trackUpload={editor.trackUpload} onChoose={(assets) => { for (const asset of assets) editor.addMedia(asset.ref.asset_id, asset.url); updateVariant(variant.id, (item) => ({ ...item, images: [...item.images, ...assets.map((asset) => ({ id: crypto.randomUUID(), media: asset.ref }))] })); }} /><h3 className="cms-subheading">Variant specifications · {language.toUpperCase()}</h3><TranslationField compare={compare && language !== "en"} original={variant.content.en?.specifications} value={variantTranslation.specifications} label="Variant specifications" onCopy={() => variantText("specifications", structuredClone(variant.content.en?.specifications || []))}><Specifications errors={editor.fields} prefix={`variants.${variantIndex}.content.${language}.specifications`} value={variantTranslation.specifications || []} onChange={(value) => variantText("specifications", value)} /></TranslationField><Collapsible className="cms-details" invalid={Boolean(editor.fields[`variants.${variantIndex}.code`])} title={<>Technical variant code</>}><label className="cms-field"><span>Unique code <small className="cms-required">Required to publish</small></span><input id={`variants.${variantIndex}.code`} {...fieldAttributes(editor.fields, `variants.${variantIndex}.code`)} value={variant.code} maxLength={50} onChange={(event) => updateVariant(variant.id, (item) => ({ ...item, code: event.target.value }))} />{fieldMessage(editor.fields, `variants.${variantIndex}.code`)}</label></Collapsible></div>}</> : <div className="cms-empty"><p>Add the first variant, its name and photos.</p></div>}</section>}
        </fieldset><aside className="cms-properties"><fieldset className="cms-editor-fields" disabled={disabled}><section className="cms-panel">{cover && <CMSImage className="cms-context-cover" src={cover} />}<h2>Product properties</h2><p className="cms-context">Shared across languages</p><label className="cms-field"><span>Category</span><Select id="category" {...fieldAttributes(editor.fields, "category")} value={data.category} onValueChange={(value) => editor.change((previous) => ({ ...previous, category: value }))}>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>{fieldMessage(editor.fields, "category")}</label><label className="cms-field"><span>Manufacturer <small className="cms-required">Required to publish</small></span><input id="brand" {...fieldAttributes(editor.fields, "brand")} value={data.brand} onChange={(event) => editor.change((previous) => ({ ...previous, brand: event.target.value }))}  maxLength={120}/>{fieldMessage(editor.fields, "brand")}</label><label className="cms-field"><span>Page URL</span><input id="slug" {...fieldAttributes(editor.fields, "slug")} value={data.slug} maxLength={50} placeholder="Generated automatically" onChange={(event) => editor.change((previous) => ({ ...previous, slug: event.target.value }))} />{fieldMessage(editor.fields, "slug")}<small>Keep the URL after publication so existing links continue to work.</small></label><TranslationSummary site={site} reviews={document.translation_review} unsaved={editor.unsaved} coverage={languageCoverage} onLanguage={setLanguage} /><p className="cms-context">Draft updated: {dateTime(document.updated_at)}</p></section></fieldset></aside></div>
      </div>
    </div>
    {confirm === "publish" && <PublishReview onWebsite={document.target_id !== null ? () => { setConfirm(null); setWebsiteOpen(true); } : undefined} onError={editor.report} site={site} kind="products" title={data.name || "New product"} prepare={editor.flush} busy={Boolean(busy)} onClose={() => setConfirm(null)} label={errorLabel} onField={(path, fields) => { if (fields) editor.report(new APIError("Fix before publishing.", 422, fields)); goToField(path); }} onPublish={(version) => { void action("publish", { version }); }} />}
    <Modal preventDismiss={Boolean(busy)} open={confirm === "unpublish"} onClose={() => setConfirm(null)} title="Unpublish product?" description="The product will be removed from the public catalogue and retained in CMS."><footer><button className="cms-button" onClick={() => setConfirm(null)}>Cancel</button><button className="cms-button cms-danger" disabled={disabled} onClick={() => { void action("unpublish"); }}>Unpublish</button></footer></Modal>
    {websiteOpen && <WebsiteComparison site={site} prepare={editor.flush} label={errorLabel} onClose={() => setWebsiteOpen(false)} onResolved={(value) => { editor.replace(value); setNotice("Your draft was preserved in Version history. The current website version is now open. Nothing was published."); }} />}
    <Modal open={confirm === "reload"} onClose={() => setConfirm(null)} title="Open latest version?" description="Unsaved changes in this form will be replaced. Create a copy first to keep them."><footer><button className="cms-button" onClick={() => setConfirm(null)}>Stay</button><button className="cms-button" onClick={() => { setConfirm(null); editor.reload(); }}>Replace my version</button></footer></Modal>
    <Modal open={deleteVariant !== null} onClose={() => setDeleteVariant(null)} title={`Remove variant “${data.variants.find((item) => item.id === deleteVariant)?.content[language]?.label || data.variants.find((item) => item.id === deleteVariant)?.code || ""}»?`} description="Removal is saved to the draft. The variant stays on the website until you publish the product changes."><footer><button className="cms-button" onClick={() => setDeleteVariant(null)}>Cancel</button><button className="cms-button cms-danger" onClick={() => { editor.change((previous) => ({ ...previous, variants: previous.variants.filter((item) => item.id !== deleteVariant) })); setDeleteVariant(null); }}>Remove variant</button></footer></Modal>
    <Modal className="cms-history-modal" open={history !== null} onClose={() => setHistory(null)} title="Version history" description="Restoring creates a new draft. The published website will not change."><div className="cms-history-body">{editor.error && <ErrorMessage message={editor.error} />}{comparisonVersion !== null && <HistoryChanges site={site} version={comparisonVersion} prepare={editor.flush} disabled={disabled} onRestore={() => { void action("restore", { restore_version: comparisonVersion }); }} label={errorLabel} onClose={() => setComparisonVersion(null)} />}<div className="cms-history">{history?.map((revision) => <div key={revision.version}><div><strong>{revisionTitle(revision.action)}</strong><small>Version {revision.version} · {dateTime(revision.created_at)} · {revision.author}</small></div><div className="cms-row-actions"><button className="cms-button" disabled={disabled} aria-pressed={comparisonVersion === revision.version} onClick={() => setComparisonVersion(revision.version)}>Compare changes</button><button className="cms-button" disabled={disabled} onClick={() => { void showPreview(revision.version); }}>Preview</button><RestoreButton version={revision.version} disabled={disabled} onRestore={() => { void action("restore", { restore_version: revision.version }); }} /></div></div>)}</div>{historyMore && <button className="cms-button" disabled={disabled} onClick={() => { void showHistory(history?.at(-1)?.version); }}>Earlier versions</button>}</div></Modal>
    <PreviewSurface open={preview !== null} onClose={() => setPreview(null)} title={preview?.published ? "Published version" : preview?.revision ? `Preview · version ${preview.revision}` : "Draft preview"} description={`${data.name} · ARMS · arms.ai-def.com`}><div className="cms-preview-tools"><label>Language<Select aria-label="Preview language" value={language} onValueChange={(selectedValue) => setLanguage(selectedValue)}>{languages.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</Select>{fieldMessage(editor.fields, "category")}</label><div><button className="cms-button" aria-pressed={!mobilePreview} onClick={() => setMobilePreview(false)}>Desktop</button><button className="cms-button" aria-pressed={mobilePreview} onClick={() => setMobilePreview(true)}>Phone</button></div></div>{preview && <PreviewFrame currentVersion={document.version} unsaved={editor.unsaved} refresh={editor.flush} focusPath={preview.revision || preview.published ? undefined : previewFocus} onField={preview.revision || preview.published ? undefined : (path) => { if (!window.matchMedia("(min-width:1600px)").matches) setPreview(null); window.setTimeout(() => goToField(path), 0); }} mobile={mobilePreview} title="Product page preview" src={`/cms/${site}/preview/${document.id}/${language}?${new URLSearchParams({ ...(preview.published ? { published: "1" } : {}), ...(preview.revision ? { revision: String(preview.revision) } : {}) })}`} />}</PreviewSurface>
    <Modal open={editor.blocker.state === "blocked" && editor.state === "error"} onClose={() => { if (editor.blocker.state === "blocked") editor.blocker.reset(); }} title="Unable to save changes" description="Your changes remain in the open form. Stay and try saving again, or explicitly leave without saving."><footer><button className="cms-button cms-primary" onClick={() => { if (editor.blocker.state === "blocked") editor.blocker.reset(); }}>Stay</button><button className="cms-button cms-danger" onClick={() => { if (editor.blocker.state === "blocked") editor.blocker.proceed(); }}>Leave without saving</button></footer></Modal>
  </article>;
}
