import Collapsible from "../../components/ui/collapsible";
import Select from "../../components/ui/select";
import { useEffect, useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { api, APIError, mediaURL } from "./api";
import type { MediaRef } from "./api";
import type { ContentNode, ContentValue, FieldSchema, NodeSchema } from "./content-types";
import { articleBlockLabels, nodeTitle } from "./content-types";
import RichText from "./RichText";
import { ErrorMessage, focusField, Modal, RemoveButton } from "./ui";
import { useSession } from "./session";
import CMSImage from "./CMSImage";
import MediaPicker from "./MediaPicker";
import TranslationField from "./TranslationField";
import { hasTranslation, prepareTranslationFields } from "./translations";

function ListValue({ value, original, onChange, label, compact = false }: { value: ContentValue; original?: ContentValue; onChange: (value: ContentValue) => void; label: string; compact?: boolean }) {
  const list = Array.isArray(value) ? value : [];
  const originalList = Array.isArray(original) ? original : [];
  const originalObject = original && typeof original === "object" && !Array.isArray(original) ? original : {};
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return <div className="cms-structured-list">{Object.entries(value).map(([key, item]) => <div className="cms-structured-row" key={key}><label className="cms-spec-name"><span className="cms-sr">Specification name</span><input aria-invalid={Boolean(nameErrors[key])} defaultValue={key} onFocus={() => setNameErrors((previous) => ({ ...previous, [key]: "" }))} onBlur={(event) => {
      const name = event.target.value.trim();
      if (name === key) return;
      if (!name || Object.hasOwn(value, name)) {
        event.target.value = key;
        setNameErrors((previous) => ({ ...previous, [key]: !name ? "Enter a name. The previous name was kept." : "That name already exists. The previous name was kept." }));
        return;
      }
      onChange(Object.fromEntries(Object.entries(value).map(([previous, content]) => [previous === key ? name : previous, content])));
    }} />{nameErrors[key] && <small className="cms-field-error" role="alert">{nameErrors[key]}</small>}</label><ListValue value={item} original={originalObject[key]} label={key} onChange={(changed) => onChange({ ...value, [key]: changed })} /><button type="button" className="cms-icon cms-danger" aria-label={`Remove ${key}`} onClick={() => onChange(Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)))}><Trash2 /></button></div>)}<button type="button" className="cms-button" onClick={() => { let key = "Specification"; let index = 1; while (Object.hasOwn(value, key)) key = `Specification ${++index}`; onChange({ ...value, [key]: "" }); }}><Plus />Add specification</button></div>;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return <input aria-label={label} data-translation-missing={hasTranslation(original) && !hasTranslation(value) || undefined} value={String(value)} onChange={(event) => onChange(event.target.value)} />;
  return <div className="cms-structured-list">{list.map((item, index) => <div className="cms-structured-row" key={index}>{item && typeof item === "object" ? <ListValue value={item} original={originalList[index]} label={`${label} ${index + 1}`} onChange={(changed) => onChange(list.map((row, position) => position === index ? changed : row))} /> : compact ? <input data-translation-missing={hasTranslation(originalList[index]) && !hasTranslation(item) || undefined} aria-label={`${label}: row ${index + 1}`} value={String(item || "")} onChange={(event) => onChange(list.map((row, position) => position === index ? event.target.value : row))} /> : <textarea data-translation-missing={hasTranslation(originalList[index]) && !hasTranslation(item) || undefined} aria-label={`${label}: row ${index + 1}`} rows={3} value={String(item || "")} onChange={(event) => onChange(list.map((row, position) => position === index ? event.target.value : row))} />}<button type="button" className="cms-icon cms-danger" aria-label={`Delete row ${index + 1}`} onClick={() => onChange(list.filter((_, position) => position !== index))}><Trash2 /></button></div>)}<button type="button" className="cms-button" onClick={() => onChange([...list, ""])}><Plus />Add row</button></div>;
}

function ReferenceField({ id, field, value, onChange, root, site, language, invalid, describedBy }: { id: string; field: FieldSchema; value: ContentValue; onChange: (value: ContentValue) => void; root: ContentNode; site: string; language: string; invalid?: boolean; describedBy?: string }) {
  type Reference = { id: string | number; label: string; content?: Record<string, Record<string, string | null>>; version?: string };
  const [choices, setChoices] = useState<Reference[]>(field.choices);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Reference | null>(null);
  const [role, setRole] = useState("");
  const { session } = useSession();
  const canEditReference = session?.sites.find((item) => item.id === site)?.role !== "editor";
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [referenceErrors, setReferenceErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!field.reference) return;
    const abort = new AbortController();
    void api<{ items: typeof choices }>(`${site}/references/${field.reference}/`, { signal: abort.signal }).then((response) => setChoices(response.items)).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load options."); });
    return () => abort.abort();
  }, [site, field.reference]);
  const options: Reference[] = field.related_group ? (root.sections[field.related_group] || []).map((row) => ({ id: row.id, label: nodeTitle(row, language) || "New group" })) : choices;
  return <>{options.length > 12 && <input type="search" aria-label={`Search: ${field.label}`} placeholder="Search options…" value={search} onChange={(event) => setSearch(event.target.value)} />}<div className="cms-reference"><Select id={id} aria-invalid={invalid} aria-describedby={describedBy} aria-label={field.label} value={value === null ? "" : String(value)} onValueChange={(selectedValue) => { const selected = options.find((row) => String(row.id) === selectedValue); onChange(selected?.id || null); }}><option value="">{field.related_group ? "Ungrouped" : "Not selected"}</option>{options.filter((item) => item.id === value || (item.content?.name?.[language] || item.label).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((item) => <option key={item.id} value={item.id}>{item.content?.name?.[language] || item.label}</option>)}</Select>{field.reference && <><button type="button" className="cms-icon" aria-label={`Create: ${field.label}`} onClick={() => { setEditing(null); setName(""); setError(""); setReferenceErrors({}); setAdding(true); }}><Plus /></button>{value && canEditReference && <button type="button" className="cms-icon" aria-label={`Edit: ${field.label}`} onClick={() => {
    const selected = choices.find((item) => item.id === value); if (!selected) return; setEditing(selected); setName(selected.content?.name?.[language] || ""); setRole(selected.content?.role?.[language] || ""); setError(""); setReferenceErrors({}); setAdding(true);
  }}><Pencil /></button>}</>}</div>{error && !adding && <ErrorMessage message={error} />}<Modal preventDismiss={busy} open={adding} onClose={() => setAdding(false)} title={`${editing ? "Edit" : "Add"}: ${field.label}`} description={editing ? "Reference changes apply immediately to every item that uses this entry." : "Enter the main English name. Translations can be added after creation."}><label className="cms-field"><span>Name · {editing ? language.toUpperCase() : "EN"}</span><input disabled={busy} aria-label="Name" aria-invalid={Boolean(referenceErrors.name)} aria-describedby={referenceErrors.name ? `${id}-reference-name-error` : undefined} value={name} maxLength={120} onChange={(event) => { setName(event.target.value); setReferenceErrors((previous) => ({ ...previous, name: "" })); }} />{referenceErrors.name && <small className="cms-field-error" id={`${id}-reference-name-error`}>{referenceErrors.name}</small>}</label>{editing && field.reference === "authors" && <label className="cms-field"><span>Job title · {language.toUpperCase()}</span><input disabled={busy} aria-label="Job title" aria-invalid={Boolean(referenceErrors.role)} aria-describedby={referenceErrors.role ? `${id}-reference-role-error` : undefined} value={role} maxLength={120} onChange={(event) => { setRole(event.target.value); setReferenceErrors((previous) => ({ ...previous, role: "" })); }} />{referenceErrors.role && <small className="cms-field-error" id={`${id}-reference-role-error`}>{referenceErrors.role}</small>}</label>}{error && <ErrorMessage message={error} fields={referenceErrors} />}<footer><button className="cms-button" disabled={busy} onClick={() => setAdding(false)}>Cancel</button><button className="cms-button cms-primary" disabled={busy || (!name.trim() && (!editing || language === "en"))} onClick={() => {
    setBusy(true); setError(""); setReferenceErrors({}); void api<Reference>(`${site}/references/${field.reference}/`, { method: editing ? "PUT" : "POST", body: JSON.stringify(editing ? { id: editing.id, version: editing.version, language, name, ...(field.reference === "authors" ? { role } : {}) } : { name }) }).then((item) => { setChoices((previous) => editing ? previous.map((row) => row.id === item.id ? item : row) : [...previous, item]); if (!editing) onChange(item.id); setAdding(false); setEditing(null); setName(""); }).catch((failure: unknown) => { setError(failure instanceof Error ? failure.message : "Unable to save."); setReferenceErrors(failure instanceof APIError ? failure.fields : {}); }).finally(() => setBusy(false));
  }}>{busy ? "Saving…" : editing ? "Update all content" : "Add"}</button></footer></Modal></>;
}

export type FieldsProps = { node: ContentNode; schema: NodeSchema; language: string; site: string; root: ContentNode; media: Record<string, string>; path: string; update: (value: ContentNode) => void; upload: (file: File, callback: (ref: MediaRef) => void, kind: "image" | "video") => void; errors: Record<string, string>; compare?: boolean; addMedia: (key: string, url: string) => void; trackUpload: (task: Promise<void>) => void; disabled?: boolean };
export default function ContentFields({ node, schema, language, site, root, media, path, update, upload, errors, compare = false, addMedia, trackUpload, disabled = false }: FieldsProps) {
  function fieldUI(field: FieldSchema) {
    const all = node.fields[field.key];
    const translations = field.translated && all && typeof all === "object" && !Array.isArray(all) ? all : {};
    const value = field.translated ? translations[language] ?? null : all;
    const prepared = field.type === "json" && field.translated && language !== "en" && translations.en && typeof translations.en === "object" ? prepareTranslationFields(translations.en, value) : value;
    const fieldPath = `${path ? path + "." : ""}fields.${field.key}${field.translated ? "." + language : ""}`;
    function change(changed: ContentValue) { update({ ...node, fields: { ...node.fields, [field.key]: field.translated ? { ...translations, [language]: changed } : changed } }); }
    const label = `${field.label}${field.translated ? ` · ${language.toUpperCase()}` : ""}`;
    const error = errors[fieldPath] || (field.translated ? errors[fieldPath.replace(/\.[a-z]{2}$/, "")] : "");
    const hint = [field.required && field.key !== "slug" && !["boolean", "number"].includes(field.type) ? `Required to publish${field.translated ? " in English" : ""}.` : "", !field.translated ? "Shared across languages." : "", field.max_length && field.type !== "file" ? `Up to ${field.max_length} characters.` : ""].filter(Boolean).join(" ");
    const describedBy = [error ? `${fieldPath}-error` : "", hint ? `${fieldPath}-help` : ""].filter(Boolean).join(" ") || undefined;
    let control;
    if (field.type === "file") {
      const ref = value as MediaRef | null;
      const source = mediaURL(ref, media);
      control = <div className="cms-file-field">{source && (field.key === "video" ? <video src={source} controls preload="metadata" /> : <CMSImage src={source} />)}<div className="cms-row-actions"><MediaPicker context={`${field.label} · ${nodeTitle(root, language) || "Material"}`} site={site} kind={field.key === "video" ? "video" : "image"} currentURL={source} label="Choose from library" trackUpload={trackUpload} onChoose={([asset]) => { addMedia(asset.ref.asset_id, asset.url); change(asset.ref); }} /><label className="cms-button cms-file"><ImagePlus />{source ? "Replace with file" : "Upload file"}<input id={fieldPath} aria-invalid={Boolean(error)} aria-describedby={describedBy} aria-label={`Upload: ${field.label}`} type="file" accept={field.key === "video" ? "video/mp4,video/webm" : "image/jpeg,image/png,image/webp"} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file, change, field.key === "video" ? "video" : "image"); event.target.value = ""; }} /></label>{value && <RemoveButton label={field.label.toLowerCase()} disabled={disabled} onRemove={() => change(null)} />}</div><small>{field.key === "video" ? "MP4/WebM: up to 45 MiB." : "JPEG, PNG, WebP: up to 20 MiB and 40 megapixels."}</small></div>;
    } else if (field.key === "icon_lucide") {
      const icons: Record<string, string> = { "": "No icon", Box: "Product", Gauge: "Specifications", Cpu: "Technology", Radio: "Communication", Shield: "Protection", Settings: "Settings", Battery: "Energy", Navigation: "Navigation" };
      control = <Select id={fieldPath} aria-invalid={Boolean(error)} aria-describedby={describedBy} value={String(value || "")} onValueChange={(selectedValue) => change(selectedValue)}>{value && !Object.hasOwn(icons, String(value)) && <option value={String(value)}>Current icon · {String(value)}</option>}{Object.entries(icons).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</Select>;
    } else if (field.type === "reference") control = <ReferenceField id={fieldPath} field={field} value={value} onChange={change} root={root} site={site} language={language} invalid={Boolean(error)} describedBy={describedBy} />;
    else if (field.type === "boolean") control = <input id={fieldPath} aria-label={label} type="checkbox" className="ui-checkbox" aria-invalid={Boolean(error)} aria-describedby={describedBy} checked={Boolean(value)} onChange={(event) => change(event.target.checked)} />;
    else if (field.choices.length) control = <Select id={fieldPath} aria-invalid={Boolean(error)} aria-describedby={describedBy} value={String(value || "")} onValueChange={(selectedValue) => change(selectedValue)}>{field.choices.map((choice) => <option key={choice.id} value={choice.id}>{field.key === "kind" ? articleBlockLabels[String(choice.id)] || choice.label : choice.label}</option>)}</Select>;
    else if (field.type === "json") control = <div id={fieldPath} role="group" aria-label={label} tabIndex={-1}>{JSON.stringify(prepared) !== JSON.stringify(value) && <div className="cms-translation-structure"><button type="button" className="cms-button" onClick={() => { change(prepared); requestAnimationFrame(() => focusField(fieldPath)); }}>Add empty translation fields</button><p className="cms-muted">Uses the English structure and keeps your existing translations. English text is not copied.</p></div>}<ListValue value={value} original={field.translated && language !== "en" ? translations.en : undefined} onChange={change} label={label} compact={field.key === "tags"} /></div>;
    else if (field.type === "richtext") control = <RichText disabled={disabled} id={fieldPath} value={String(value || "")} onChange={change} label={label} invalid={Boolean(error)} describedBy={describedBy} />;
    else if (field.type === "date") control = <input id={fieldPath} type="date" min="0001-01-01" max="9999-12-31" aria-label={label} aria-invalid={Boolean(error)} aria-describedby={describedBy} value={String(value || "")} onChange={(event) => change(event.target.value || null)} />;
    else if (field.type === "text") control = <textarea id={fieldPath} aria-label={label} rows={5} aria-invalid={Boolean(error)} aria-describedby={describedBy} value={String(value || "")} maxLength={field.max_length || undefined} onChange={(event) => change(event.target.value)} />;
    else control = <input id={fieldPath} aria-label={label} type={field.type === "number" ? "number" : "text"} aria-invalid={Boolean(error)} aria-describedby={describedBy} min={field.type === "number" ? 0 : undefined} maxLength={field.max_length || undefined} value={value === null ? "" : String(value ?? "")} onChange={(event) => change(field.type === "number" ? event.target.value === "" ? null : Number(event.target.value) : event.target.value)} />;
    const content = <div className={`cms-field${field.type === "boolean" ? " cms-checkbox-field" : ""}`} key={field.key} data-field-path={fieldPath} tabIndex={-1} aria-invalid={Boolean(error)} aria-describedby={describedBy}><label htmlFor={fieldPath}>{label}{field.required && field.key !== "slug" && !["boolean", "number"].includes(field.type) && <small className="cms-required">Required to publish{field.translated ? " · EN" : ""}</small>}{!field.translated && <small className="cms-shared">Shared across languages</small>}</label>{hint && <small id={`${fieldPath}-help`} className="cms-sr">{hint}</small>}{control}{typeof value === "string" && field.max_length && value.length >= field.max_length * 0.9 && <small className="cms-limit">{value.length}/{field.max_length} characters</small>}{error && <small id={`${fieldPath}-error`} className="cms-field-error">{error}</small>}{field.translated && language !== "en" && !hasTranslation(value) && hasTranslation(translations.en) && <div className="cms-fallback"><span>No translation yet. The website uses the English text.</span>{!compare && <button type="button" onClick={() => change(structuredClone(translations.en))}>Copy English</button>}</div>}</div>;
    return field.translated ? <TranslationField key={`${field.key}:${language}`} compare={compare && language !== "en"} original={translations.en} value={value} label={field.label} onCopy={() => change(structuredClone(translations.en))}>{content}</TranslationField> : content;
  }
  const blockKind = String(node.fields.kind || "");
  const hidden = new Set(["paragraphs", "items"]);
  const advancedKeys = new Set(["slug", "anchor_id", "icon_lucide", "icon_file", "icon_type", "kind", ...(schema.fields.some((field) => field.key === "html") ? ["title"] : [])]);
  const html = node.fields.html;
  const activeHTML = html && typeof html === "object" && !Array.isArray(html) ? html[language] || html.en : html;
  const legacyData = !["image", "divider"].includes(blockKind) && !(typeof activeHTML === "string" && activeHTML.trim()) && schema.fields.some((field) => field.key === "html") ? schema.fields.filter((field) => hidden.has(field.key) && node.fields[field.key] && Object.values(node.fields[field.key] as object).some((item) => Array.isArray(item) && item.length)) : [];
  const regular = schema.fields.filter((field) => !advancedKeys.has(field.key) && (!hidden.has(field.key) || !schema.fields.some((item) => item.key === "html")) && !(blockKind && field.key === "html" && ["image", "divider"].includes(blockKind)) && !(blockKind && ["image", "image_alt"].includes(field.key) && blockKind !== "image"));
  const advanced = schema.fields.filter((field) => advancedKeys.has(field.key));
  return <>{regular.map(fieldUI)}{legacyData.length > 0 && <Collapsible className="cms-details" invalid={legacyData.some((field) => Object.keys(errors).some((key) => key.startsWith(`${path ? path + "." : ""}fields.${field.key}`)))} title={<>Legacy editor content</>}><p className="cms-muted">Legacy content has been preserved. If the main block text is filled in, the website uses it instead.</p>{legacyData.map(fieldUI)}</Collapsible>}{advanced.length > 0 && <Collapsible className="cms-details" invalid={advanced.some((field) => Object.keys(errors).some((key) => key.startsWith(`${path ? path + "." : ""}fields.${field.key}`)))} title={<>Additional settings</>}>{advanced.map(fieldUI)}</Collapsible>}</>;
}
