import type { ContentValue } from "./content-types";

const shortCopy = new Set(["title", "kicker", "cta", "pill", "badge", "name", "category", "slideAlt", "slideAria", "hqTitle", "addressesLabel", "view", "download", "viewDocument", "downloadDocument", "success", "industrialSecurity", "ministryPermit", "categoryAExemption", "categoryAExemptionAmended", "weaponsLicense", "phases"]);

export function pageCopyLimit(path: string) {
  const key = path.split(".").filter((part) => !/^\d+$/.test(part)).at(-1) || "";
  return shortCopy.has(key) ? 255 : 30000;
}

export function pageSections(contents: Record<string, ContentValue>): [string, ContentValue][] {
  const entries = Object.entries(contents);
  const copy = entries.filter(([, value]) => typeof value === "string");
  return [...(copy.length ? [["__main", Object.fromEntries(copy)] as [string, ContentValue]] : []), ...entries.filter(([, value]) => typeof value !== "string")];
}

export function replacePageSection(contents: Record<string, ContentValue>, section: string, value: ContentValue) {
  return section === "__main" ? { ...contents, ...value as Record<string, ContentValue> } : { ...contents, [section]: value };
}
