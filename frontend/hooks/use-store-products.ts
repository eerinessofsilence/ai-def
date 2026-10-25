import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { StoreProduct } from "../src/pages/store-products";

const rawBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api";
const normalizedBase = rawBase.replace(/\/+$/, "");
const apiBase = normalizedBase.endsWith("/api") ? normalizedBase : normalizedBase + "/api";

export function useStoreProducts(enabled = true) {
  const { i18n } = useTranslation();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    setProducts([]);
    fetch(apiBase + "/arms/products/?lang=" + encodeURIComponent(i18n.language), {
      signal: controller.signal,
      headers: { "Accept-Language": i18n.language },
    }).then(async (response) => {
      if (!response.ok) throw new Error("Catalogue request failed");
      const result: StoreProduct[] = await response.json();
      if (!Array.isArray(result)) throw new Error("Invalid catalogue");
      if (!controller.signal.aborted) setProducts(result);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [enabled, i18n.language, attempt]);
  return { products, loading, error, retry: () => setAttempt((value) => value + 1) };
}
