export type ContentChange = { path: string; before: unknown; after: unknown; type: "value" | "order" | "added" | "removed" };

export function textDifference(before: string, after: string) {
  // shortcut: highlight one span per field; use word-level diff if distant edits become hard to review.
  const old = Array.from(before), next = Array.from(after);
  let prefix = 0, suffix = 0;
  while (prefix < old.length && prefix < next.length && old[prefix] === next[prefix]) prefix++;
  while (suffix < old.length - prefix && suffix < next.length - prefix && old[old.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
  const parts = (text: string[]) => ({ prefix: text.slice(0, prefix).join(""), changed: text.slice(prefix, text.length - suffix).join(""), suffix: suffix ? text.slice(-suffix).join("") : "" });
  return { before: parts(old), after: parts(next) };
}

export function isCurrentPreview(version: unknown, currentVersion: number | undefined, unsaved: boolean) {
  return !unsaved && (currentVersion === undefined || version === currentVersion);
}

function media(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && ("asset_id" in value || ("path" in value && "storage" in value)));
}

export function contentChanges(before: unknown, after: unknown, path = ""): ContentChange[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if ((before == null || before === "") && (after == null || after === "")) return [];
  if (media(before) || media(after)) return [{ path, before, after, type: "value" }];
  if (Array.isArray(before) || Array.isArray(after)) {
    const oldRows: unknown[] = Array.isArray(before) ? before : [];
    const newRows: unknown[] = Array.isArray(after) ? after : [];
    const identified = [...oldRows, ...newRows].every((row) => row !== null && typeof row === "object" && "id" in row);
    if (identified) {
      const oldItems = oldRows as { id: string | number }[];
      const newItems = newRows as { id: string | number }[];
      const changes: ContentChange[] = [];
      const survivingOld = oldItems.filter((row) => newItems.some((item) => item.id === row.id)).map((row) => row.id);
      const survivingNew = newItems.filter((row) => oldItems.some((item) => item.id === row.id)).map((row) => row.id);
      if (JSON.stringify(survivingOld) !== JSON.stringify(survivingNew)) changes.push({ path, before: survivingOld, after: survivingNew, type: "order" });
      oldItems.forEach((row, index) => {
        if (!newItems.some((item) => item.id === row.id)) changes.push({ path: `${path}.${index}`, before: row, after: null, type: "removed" });
      });
      newItems.forEach((row, index) => {
        const old = oldItems.find((item) => item.id === row.id);
        if (!old) changes.push({ path: `${path}.${index}`, before: null, after: row, type: "added" });
        else changes.push(...contentChanges(old, row, `${path}.${index}`));
      });
      return changes;
    }
    return Array.from({ length: Math.max(oldRows.length, newRows.length) }, (_, index) => contentChanges(oldRows[index], newRows[index], `${path}.${index}`)).flat();
  }
  if ((before !== null && typeof before === "object") || (after !== null && typeof after === "object")) {
    const old = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
    const next = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
    return [...new Set([...Object.keys(old), ...Object.keys(next)])].filter((key) => key !== "id").flatMap((key) => contentChanges(old[key], next[key], path ? `${path}.${key}` : key));
  }
  return [{ path, before, after, type: "value" }];
}

export function changeLanguage(path: string): string | null {
  return path.split(".").find((part) => ["en", "de", "sk", "es", "fr", "it", "ru"].includes(part)) || null;
}

export function readablePath(path: string): string {
  return path.split(".").filter((part) => !["fields", "sections", "content"].includes(part)).map((part) => /^\d+$/.test(part) ? String(Number(part) + 1) : part.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase())).join(" · ");
}
