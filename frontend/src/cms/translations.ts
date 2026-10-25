import type { ArmsData, TranslationReviewStatus } from "./api";
import { fieldLabel } from "./content-types.ts";
import type { ContentNode, FieldSchema, NodeSchema } from "./content-types";
import type { ContentValue } from "./content-types";

export type Coverage = { filled: number; total: number };

export function reviewLabel(status: TranslationReviewStatus | undefined, unsaved = false) {
  if (unsaved) return "Save changes to update review status";
  if (!status) return "Review status unavailable";
  if (!status.total) return "No translation values to review";
  if (status.missing) return "Translation incomplete";
  if (status.source_changed) return "English source changed";
  if (status.translation_changed) return "Translation changed since review";
  if (status.unreviewed) return "Not reviewed";
  return "Reviewed against current English";
}

export function blankTranslation(value: ContentValue): ContentValue {
  if (typeof value === "string") return "";
  if (Array.isArray(value)) return value.map(blankTranslation);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, blankTranslation(child)]));
  return value;
}

export function prepareTranslationFields(original: ContentValue, translated: ContentValue | undefined): ContentValue {
  if (Array.isArray(original)) {
    if (translated != null && !Array.isArray(translated)) return translated;
    const current = Array.isArray(translated) ? translated : [];
    return [...original.map((value, index) => prepareTranslationFields(value, current[index])), ...current.slice(original.length)];
  }
  if (original && typeof original === "object") {
    if (translated != null && (typeof translated !== "object" || Array.isArray(translated))) return translated;
    const current = translated && typeof translated === "object" && !Array.isArray(translated) ? translated : {};
    return { ...current, ...Object.fromEntries(Object.entries(original).map(([key, value]) => [key, prepareTranslationFields(value, current[key])])) };
  }
  return translated ?? (typeof original === "string" ? "" : original);
}

export function plainText(value: string) {
  const text = value.replace(/<\/(?:p|h[1-6]|li|blockquote)>/gi, "\n").replace(/<[^>]*>/g, "");
  if (typeof document !== "undefined") {
    const decoder = document.createElement("textarea");
    decoder.innerHTML = text;
    return decoder.value.replace(/\u00a0/g, " ");
  }
  return text.replace(/&nbsp;|&#160;/gi, " ").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function hasTranslation(value: unknown): boolean {
  if (typeof value === "string") return Boolean(plainText(value).trim());
  if (Array.isArray(value)) return value.some(hasTranslation);
  if (value && typeof value === "object") return Object.values(value).some(hasTranslation);
  return false;
}

export function coverage(original: unknown, translated: unknown): Coverage {
  if (typeof original === "string") return hasTranslation(original) ? { total: 1, filled: hasTranslation(translated) ? 1 : 0 } : { total: 0, filled: 0 };
  const values = original && typeof original === "object" ? Object.entries(original) : [];
  return values.reduce<Coverage>((result, [key, value]) => {
    const next = coverage(value, translated && typeof translated === "object" ? (translated as Record<string, unknown>)[key] : undefined);
    return { total: result.total + next.total, filled: result.filled + next.filled };
  }, { total: 0, filled: 0 });
}

function add(a: Coverage, b: Coverage): Coverage { return { filled: a.filled + b.filled, total: a.total + b.total }; }

function translatedFields(node: ContentNode, schema: NodeSchema): FieldSchema[] {
  return schema.fields.filter((field) => {
    if (!field.translated) return false;
    if (!schema.fields.some((item) => item.key === "html")) return true;
    const kind = String(node.fields.kind || "text");
    if (field.key === "image_alt" && kind !== "image") return false;
    if (["html", "paragraphs", "items"].includes(field.key) && ["image", "divider"].includes(kind)) return false;
    const html = node.fields.html;
    if (["paragraphs", "items"].includes(field.key) && html && typeof html === "object" && !Array.isArray(html) && hasTranslation(html.en)) return false;
    return true;
  });
}

export function contentCoverage(node: ContentNode, schema: NodeSchema, language: string): Coverage {
  let result: Coverage = { filled: 0, total: 0 };
  for (const field of translatedFields(node, schema)) {
    const value = node.fields[field.key];
    if (field.translated && value && typeof value === "object" && !Array.isArray(value)) result = add(result, coverage(value.en, value[language]));
  }
  for (const [key, relation] of Object.entries(schema.relations)) {
    if (relation.group === "legacy" && node.sections.blocks?.length) continue;
    for (const child of node.sections[key] || []) result = add(result, contentCoverage(child, relation, language));
  }
  return result;
}

export type MissingTranslation = { path: string; label: string; missing: number };

export function contentMissing(node: ContentNode, schema: NodeSchema, language: string): MissingTranslation[] {
  if (language === "en") return [];
  const result: MissingTranslation[] = [];
  function visit(row: ContentNode, definition: NodeSchema, prefix: string) {
    for (const field of translatedFields(row, definition)) {
      const value = row.fields[field.key];
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const progress = coverage(value.en, value[language]);
      const path = `${prefix}fields.${field.key}.${language}`;
      if (progress.filled < progress.total) result.push({ path, label: fieldLabel(path, schema), missing: progress.total - progress.filled });
    }
    for (const [key, relation] of Object.entries(definition.relations)) {
      if (relation.group === "legacy" && row.sections.blocks?.length) continue;
      (row.sections[key] || []).forEach((child, index) => visit(child, relation, `${prefix}sections.${key}.${index}.`));
    }
  }
  visit(node, schema, "");
  return result;
}

export function missingValues(original: unknown, translated: unknown, path: string): string[] {
  if (typeof original === "string") return hasTranslation(original) && !hasTranslation(translated) ? [path] : [];
  if (!original || typeof original !== "object") return [];
  return Object.entries(original).flatMap(([key, value]) => missingValues(value, translated && typeof translated === "object" ? (translated as Record<string, unknown>)[key] : undefined, `${path}.${key}`));
}

export function armsMissing(data: ArmsData, language: string): string[] {
  if (language === "en") return [];
  const result = missingValues(data.content.en, data.content[language], `content.${language}`);
  data.variants.forEach((variant, index) => {
    result.push(...missingValues(variant.content.en, variant.content[language], `variants.${index}.content.${language}`));
    variant.images.forEach((image, photo) => result.push(...missingValues(image.alt?.en, image.alt?.[language], `variants.${index}.images.${photo}.alt.${language}`)));
  });
  return result;
}

export function armsCoverage(data: ArmsData, language: string): Coverage {
  let result = coverage(data.content.en, data.content[language]);
  for (const variant of data.variants) {
    result = add(result, coverage(variant.content.en, variant.content[language]));
    for (const image of variant.images) result = add(result, coverage(image.alt?.en, image.alt?.[language]));
  }
  return result;
}

export function coverageLabel(value: Coverage) {
  if (!value.total) return "No translatable fields";
  return `${value.filled}/${value.total} · ${value.filled === 0 ? "not started" : value.filled < value.total ? "partial" : "fields complete"}`;
}
