export class APIError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const AUTH_REQUIRED_EVENT = "cms-auth-required";
export const SESSION_RESTORED_EVENT = "cms-session-restored";
let csrf = "";

export async function api<T>(path: string, options: RequestInit = {}, retryCsrf = true): Promise<T> {
  const sentCsrf = csrf;
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (options.method && options.method !== "GET") headers.set("X-CSRFToken", csrf);
  const response = await fetch(`/api/cms/${path}`, { ...options, headers, credentials: "same-origin", cache: "no-store" }).catch((failure: unknown) => {
    if (options.signal?.aborted) throw failure;
    throw new Error("Unable to connect to CMS. The server may be temporarily unavailable. Please try again in a moment.");
  });
  const result = await response.json().catch(() => null);
  // Signing in in another tab rotates the cookie while this tab keeps its old token.
  if (response.status === 403 && result === null && options.method && options.method !== "GET" && retryCsrf) {
    const session = await api<Session>("session/");
    if (!session.authenticated && path !== "session/" && typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    if ((session.authenticated || path === "session/") && csrf && csrf !== sentCsrf) return api<T>(path, options, false);
  }
  if (response.status === 401 && path !== "session/" && typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  if (!response.ok) throw new APIError(result?.error || (response.status >= 500 ? "The CMS server is temporarily unavailable. Please try again in a moment." : response.status === 403 ? "Access denied. Your open form has been kept. Check your account access or sign in again." : "Unable to complete this action. Please try again."), response.status, result?.fields);
  if (result === null) throw new APIError("CMS returned an unreadable response. Please try again in a moment.", response.status);
  if (result?.csrf) csrf = result.csrf;
  if (result?.authenticated && typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_RESTORED_EVENT));
  return result as T;
}

export type Site = "ai-def" | "arms";
export type Session = {
  environment?: "local" | "live";
  authenticated: boolean;
  user: { name: string; is_superuser: boolean } | null;
  sites: { id: Site; name: string; role: "editor" | "publisher" | "manager"; can_portal: boolean }[];
};
export type MediaRef = { asset_id: string } | { path: string; storage: boolean };
export type MediaKind = "image" | "video" | "document";
export type MediaAsset = {
  ref: { asset_id: string }; name: string; kind: MediaKind | "unknown"; url: string;
  width: number | null; height: number | null; size_bytes: number | null; created_at: string;
  original_name?: string; display_name?: string; usage_count?: number; materials?: string[];
};
export type AssetUsage = { kind: string; id: string; identity: string; name: string; state: "published" | "unpublished" | "stored" | "draft" | "history"; version: number | null; locations: string[] };
export type AssetDetails = MediaAsset & { version: string; usages: AssetUsage[] };
export type AssetList = { items: MediaAsset[]; page: number; pages: number; total: number };
export type Specification = { label: string; value: string };
export type Translation = { description?: string; cover_alt?: string; label?: string; specifications: Specification[] };
export type ArmsVariant = {
  id: number | string;
  code: string;
  model_name: string;
  content: Record<string, Translation>;
  images: { id: number | string; media: MediaRef; alt?: Record<string, string> }[];
};
export type ArmsData = {
  name: string; slug: string; brand: string; category: string;
  cover: MediaRef | null; content: Record<string, Translation>;
  width: number; height: number; variants: ArmsVariant[];
};
export type CMSDocument<T = ArmsData> = {
  id: string; site: Site; kind: string; target_id: number | null;
  data: T; version: number; media: Record<string, string>;
  status: "draft" | "published" | "changes"; updated_at: string; published_at: string | null;
  translation_review?: Record<string, TranslationReviewStatus>;
};
export type TranslationReviewStatus = {
  total: number; missing: number; source_changed: number; translation_changed: number; unreviewed: number; reviewed: number;
  checked_at: string | null; issues: { path: string; state: "missing" | "source_changed" | "translation_changed" | "unreviewed" }[];
};
export type ProductRow = {
  document_id: string | null; target_id: number | null; name: string;
  category: string; cover: MediaRef | null; media: Record<string, string>;
  status: CMSDocument["status"]; updated_at: string | null;
};
export type ProductList = { items: ProductRow[]; page: number; pages: number; total: number };
export type Revision = { version: number; action: string; created_at: string; author: string };

export const statuses = { draft: "Draft", published: "Published", changes: "Unpublished changes" };
export const languages = [["en", "English"], ["de", "German"], ["sk", "Slovak"], ["es", "Spanish"], ["fr", "French"], ["it", "Italian"], ["ru", "Russian"]] as const;
export function revisionTitle(action: string) {
  if (action.startsWith("review_")) return `${languages.find(([code]) => code === action.slice(7))?.[1] || "Translation"} reviewed`;
  return ({ created: "Draft created", saved: "Draft saved", opened: "Original version", publish: "Published", unpublish: "Unpublished", restore: "Version restored", refreshed: "Refreshed from catalogue", refresh: "Refreshed from catalogue", saved_copy: "Separate copy saved", media_repair: "Media repaired" } as Record<string, string>)[action] || "Change";
}
export const categories: Record<string, string> = { pistols: "Pistols", automatic: "Automatic firearms" };

export function mediaURL(ref: MediaRef | null, media: Record<string, string>) {
  if (!ref) return "";
  return media["asset_id" in ref ? ref.asset_id : `${ref.storage ? "stored" : "legacy"}:${ref.path}`] || "";
}

export function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
