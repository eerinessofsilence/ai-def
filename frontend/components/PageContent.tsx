import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type PagePayload = { name: string; slug: string; site: string; content: Record<string, unknown>; assets: Record<string, string> };
const Context = createContext<PagePayload | null>(null);
const raw = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api";
const base = raw.replace(/\/+$/, "");
const apiBase = base.endsWith("/api") ? base : base + "/api";

export function PageContentProvider({ site, slug, children, previewData }: { site: string; slug: string; children: ReactNode; previewData?: PagePayload }) {
  const { i18n } = useTranslation();
  const [data, setData] = useState<PagePayload | null>(null);
  const inherited = useContext(Context);
  const preview = previewData || (inherited?.site === site && inherited.slug === slug ? inherited : null);
  useEffect(() => {
    if (preview) return;
    const abort = new AbortController(); setData(null);
    void fetch(`${apiBase}/pages/${site}/${slug}/?lang=${encodeURIComponent(i18n.language)}`, { signal: abort.signal }).then(async (response) => {
      if (!response.ok) throw new Error("Page content unavailable");
      const result: PagePayload = await response.json();
      if (!abort.signal.aborted) setData(result);
    }).catch(() => { /* The bundled content remains available during an API outage. */ });
    return () => abort.abort();
  }, [site, slug, i18n.language, preview]);
  return <Context.Provider value={preview || data}>{children}</Context.Provider>;
}

export function usePageContent() {
  const data = useContext(Context);
  return { asset: (key: string, fallback: string) => data?.assets[key] || fallback };
}

export function usePageTranslation() {
  const original = useTranslation();
  const data = useContext(Context);
  const t = useMemo(() => {
    if (!data) return original.t;
    return ((key: string, options?: Record<string, unknown>) => {
      let value: unknown = data.content;
      for (const part of key.split(".")) value = value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined;
      if (typeof value === "string") return value.replace(/\{\{\s*([^} ]+)\s*\}\}/g, (match, name: string) => options?.[name] !== undefined ? String(options[name]) : match);
      if (value !== undefined && options?.returnObjects) return value;
      return original.t(key, options);
    }) as typeof original.t;
  }, [data, original.t]);
  return { ...original, t };
}
