export type ContentValue = string | number | boolean | null | ContentValue[] | { [key: string]: ContentValue };
export const articleBlockLabels: Record<string, string> = { text: "Text", bullets: "List", quote: "Quote", image: "Image", divider: "Divider" };
export type ContentNode = { id: string | number; fields: Record<string, ContentValue>; sections: Record<string, ContentNode[]> };
export type FieldSchema = {
  key: string; label: string; type: string; translated: boolean; required: boolean;
  max_length: number | null; default: ContentValue;
  choices: { id: string | number; label: string }[]; reference: string | null; related_group: string | null;
};
export type NodeSchema = { fields: FieldSchema[]; relations: Record<string, NodeSchema>; label: string; group: string; single: boolean };
export const collectionNames: Record<string, string> = { products: "Products", "civil-products": "Civil products", articles: "Articles", portal: "Client portal", modules: "Shared modules" };
export function relationNeighbor(rows: ContentNode[], index: number, direction: number): number | undefined {
  if (!rows[index] || ![-1, 1].includes(direction)) return undefined;
  const group = rows[index].fields.block ?? null;
  for (let target = index + direction; target >= 0 && target < rows.length; target += direction) {
    if ((rows[target].fields.block ?? null) === group) return target;
  }
  return undefined;
}
export function fieldLabel(path: string, schema: NodeSchema): string {
  const parts = path.split(".");
  const names: string[] = [];
  let current = schema;
  while (parts[0] === "sections" && parts.length >= 2) {
    parts.shift();
    const key = parts.shift()!;
    const index = parts[0] && /^\d+$/.test(parts[0]) ? parts.shift() : undefined;
    const relation = current.relations[key];
    if (!relation) return names.join(" · ") || "Content";
    names.push(`${relation.label}${index === undefined ? "" : ` ${Number(index) + 1}`}`);
    current = relation;
  }
  if (parts[0] === "fields") parts.shift();
  if (parts.length) names.push(current.fields.find((field) => field.key === parts[0])?.label || "Content");
  const last = parts.at(-1);
  if (last && /^(en|de|sk|es|fr|it|ru)$/.test(last)) names.push(last.toUpperCase());
  return names.join(" · ") || "Content";
}
export function nodeTitle(node: ContentNode, language = "en", schema?: NodeSchema) {
  const module = schema?.fields.find((field) => field.key === "module")?.choices.find((choice) => choice.id === node.fields.module)?.label;
  const value = node.fields.title || node.fields.name || node.fields.subtitle || module;
  if (typeof value === "string") return value;
  if (value && !Array.isArray(value) && typeof value === "object") return String(value[language] || value.en || "");
  return "";
}
export function emptyNode(schema: NodeSchema): ContentNode {
  const fields: ContentNode["fields"] = {};
  for (const field of schema.fields) {
    const value = field.default ?? (field.key === "icon_lucide" && schema.fields.some((item) => item.key === "icon_type") ? "Box" : field.type === "boolean" ? false : field.type === "number" ? 0 : field.type === "json" ? [] : ["file", "reference", "date"].includes(field.type) ? null : field.choices[0]?.id || "");
    fields[field.key] = field.translated ? Object.fromEntries(["en", "de", "sk", "es", "fr", "it"].map((language) => [language, value])) : value;
  }
  return { id: crypto.randomUUID(), fields, sections: Object.fromEntries(Object.keys(schema.relations).map((key) => [key, []])) };
}

export function duplicateContentBlock(node: ContentNode): ContentNode {
  const copy = structuredClone(node);
  copy.id = crypto.randomUUID();
  if ("anchor_id" in copy.fields) copy.fields.anchor_id = "";
  return copy;
}
