import type { MediaRef } from "./api";
import { mediaURL } from "./api";
import type { ContentChange } from "./changes";
import { readablePath, textDifference } from "./changes";
import { plainText } from "./translations";
import { fileKind } from "./media";
import CMSImage from "./CMSImage";

export type ReferenceLabels = Record<string, Record<string, string>>;

function Value({ value, other, side = "after", media, path, references }: { value: unknown; other?: unknown; side?: "before" | "after"; media: Record<string, string>; path: string; references: ReferenceLabels }) {
  if (value === null || value === undefined || value === "") return <span className="cms-muted">Not provided</span>;
  const reference = references[path.split(".").filter((part) => !/^\d+$/.test(part)).join(".")];
  if (reference && ["string", "number"].includes(typeof value)) return <span>{reference[String(value)] || "Unavailable entry"}</span>;
  if (typeof value === "object" && ("asset_id" in value || "path" in value)) {
    const url = mediaURL(value as MediaRef, media);
    return url ? <a href={url} target="_blank" rel="noreferrer">{fileKind(new URL(url, window.location.origin).pathname) === "image" ? <CMSImage className="cms-review-photo" src={url} alt="Changed image" /> : <span className="cms-muted">File · </span>}<span>Open file</span></a> : <span className="cms-muted">File unavailable</span>;
  }
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (typeof value === "object") return <dl className="cms-review-values">{Object.entries(value).filter(([key]) => key !== "id").map(([key, child]) => <div key={key}><dt>{readablePath(key)}</dt><dd><Value value={child} other={other && typeof other === "object" ? (other as Record<string, unknown>)[key] : undefined} side={side} media={media} path={`${path}.${key}`} references={references} /></dd></div>)}</dl>;
  const template = document.createElement("template");
  if (typeof value === "string" && /<a\b/i.test(value)) template.innerHTML = value;
  const links = [...template.content.querySelectorAll("a[href]")].map((link) => ({ text: link.textContent || "Link", address: link.getAttribute("href") || "" }));
  const text = typeof value === "string" ? plainText(value) : String(value);
  const parts = typeof value === "string" ? textDifference(typeof other === "string" ? plainText(other) : "", text).after : null;
  return <><span className="cms-review-text">{parts ? <>{parts.prefix}{parts.changed && <mark className={`cms-change-${side === "before" ? "removed" : "added"}`}>{parts.changed}</mark>}{parts.suffix}</> : text}</span>{links.length > 0 && <div className="cms-review-links"><strong>Link addresses</strong><ul>{links.map((link, index) => <li key={index}><span>{link.text}</span><code>{link.address}</code></li>)}</ul></div>}</>;
}

function at(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined, value);
}

function Order({ data, ids, path, media, references }: { data: unknown; ids: unknown; path: string; media: Record<string, string>; references: ReferenceLabels }) {
  const values = at(data, path);
  const rows = Array.isArray(values) ? values : [];
  return <ol className="cms-review-order">{(Array.isArray(ids) ? ids : []).map((identifier, index) => {
    const row = rows.find((item) => item?.id === identifier);
    const name = [row?.fields?.name, row?.fields?.title, row?.fields?.html, row?.content?.en?.label, row?.name, row?.code].map((value) => typeof value === "object" ? value?.en : value).find((value) => typeof value === "string" && plainText(value).trim());
    const image = row?.media || row?.fields?.image;
    return <li key={String(identifier)}>{name ? plainText(String(name)).trim().slice(0, 100) : image ? <Value value={image} media={media} path={path} references={references} /> : `${row?.fields?.kind ? readablePath(row.fields.kind) : "Item"} · position ${index + 1}`}</li>;
  })}</ol>;
}

export default function ChangeList({ changes, before, after, media, references = {}, beforeTitle, afterTitle, label = readablePath, onEdit }: {
  changes: ContentChange[]; before: unknown; after: unknown; media: Record<string, string>; references?: ReferenceLabels;
  beforeTitle: string; afterTitle: string; label?: (path: string) => string; onEdit?: (path: string) => void;
}) {
  return <div className="cms-review-changes">{changes.map((change, index) => <details key={`${change.path}:${index}`} className="cms-review-change"><summary><span>{label(change.path)}</span><small>{change.type === "value" && typeof change.before === "string" && typeof change.after === "string" && plainText(change.before) === plainText(change.after) ? "Formatting or link changed" : { value: "Changed", order: "Order changed", added: "Added", removed: "Removed" }[change.type]}</small></summary><div className="cms-review-comparison"><section><h4>{beforeTitle}</h4>{change.type === "order" ? <Order data={before} ids={change.before} path={change.path} media={media} references={references} /> : <Value value={change.before} other={change.after} side="before" media={media} path={change.path} references={references} />}</section><section><h4>{afterTitle}</h4>{change.type === "order" ? <Order data={after} ids={change.after} path={change.path} media={media} references={references} /> : <Value value={change.after} other={change.before} side="after" media={media} path={change.path} references={references} />}</section></div>{onEdit && change.type !== "removed" && <button className="cms-button" type="button" onClick={() => onEdit(change.path)}>Edit this field</button>}</details>)}</div>;
}
