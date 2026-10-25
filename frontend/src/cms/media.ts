import type { MediaKind } from "./api";

export const mediaNames = { image: "Images", video: "Video", document: "Documents", unknown: "File" };
export const mediaAccept = {
  image: ".jpg,.jpeg,.png,.webp", video: ".mp4,.webm", document: ".pdf",
};

export const mediaHelp = {
  image: "JPEG, PNG, WebP: up to 20 MiB and 40 megapixels.",
  video: "MP4/WebM: up to 45 MiB.",
  document: "PDF: up to 20 MiB.",
};

export function fileKind(name: string): MediaKind | null {
  const extension = name.split(".").at(-1)?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(extension || "")) return "image";
  if (["mp4", "webm"].includes(extension || "")) return "video";
  return extension === "pdf" ? "document" : null;
}

export function uploadError(file: Pick<File, "name" | "size">, required?: MediaKind) {
  const kind = fileKind(file.name);
  if (!kind) return "Use JPEG, PNG, WebP, MP4, WebM or PDF.";
  if (required && kind !== required) return `Accepted file types for this field: ${mediaNames[required].toLowerCase()}.`;
  if (file.size > (kind === "video" ? 45 : 20) * 1024 * 1024) return `Maximum size: ${kind === "video" ? 45 : 20} MiB.`;
  return "";
}

export function fileSize(bytes: number | null) {
  if (bytes === null) return "Size unknown";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("en-GB", { maximumFractionDigits: 1 })} MiB`;
}
