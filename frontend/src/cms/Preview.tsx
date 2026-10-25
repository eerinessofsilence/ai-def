import { useEffect, useState } from "react";
import ProductDetail from "../pages/ProductDetail";
import type { ProductPreviewData } from "../pages/ProductDetail";
import CivilProductDetail from "../pages/CivilProductDetail";
import type { CivilProductPreviewData } from "../pages/CivilProductDetail";
import BlogPost from "../pages/BlogPost";
import type { ArticlePreviewData } from "../pages/BlogPost";
import ClientPortal from "../pages/ClientPortal";
import type { PortalPreviewData } from "../pages/ClientPortal";
import Home from "../pages/Home";
import AboutUs from "../pages/AboutUs";
import Technology from "../pages/Technology";
import Solutions from "../pages/Solutions";
import Support from "../pages/Support";
import PermitsCertificates from "../pages/PermitsCertificates";
import { PageContentProvider } from "../../components/PageContent";
import type { PagePayload } from "../../components/PageContent";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { createInstance } from "i18next";
import type { i18n as I18nInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import { localeLoaders } from "../i18n";
import type { SupportedLanguage } from "../i18n";
import { StoreProductPage } from "../pages/Store";
import type { StoreProduct } from "../pages/store-products";
import StoreHeader from "../../components/store/StoreHeader";
import StoreFooter from "../../components/store/StoreFooter";
import { api, languages } from "./api";
import { ErrorMessage, Loading } from "./ui";
import "../index.css";

export default function Preview() {
  const { site = "arms", id = "", lng = "en" } = useParams();
  const [params] = useSearchParams();
  const revision = params.get("revision") || "";
  const inspect = params.get("inspect") === "1";
  const published = params.get("published") === "1";
  const focus = params.get("focus") || "";
  const kind = params.get("kind") || "products";
  const language: SupportedLanguage = languages.some(([code]) => code === lng && (site === "arms" || code !== "ru")) ? lng as SupportedLanguage : "en";
  const [result, setResult] = useState<{ product: unknown; i18n: I18nInstance } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController(); setResult(null); setError("");
    const timeout = window.setTimeout(() => { setError("Preview did not respond. Close it and try again."); abort.abort(); }, 20000);
    void Promise.all([
      api<unknown>(`${site}/documents/${id}/preview/?${new URLSearchParams({ lang: language, ...(revision ? { revision } : {}), ...(inspect || focus ? { inspect: "1" } : {}), ...(published ? { published: "1" } : {}) })}`, { signal: abort.signal }),
      localeLoaders[language](), localeLoaders.en(),
    ]).then(async ([product, messages, english]) => {
      const instance = createInstance();
      await instance.init({ lng: language, fallbackLng: "en", defaultNS: "common", resources: { en: { common: english.default }, [language]: { common: messages.default } }, interpolation: { escapeValue: false } });
      if (!abort.signal.aborted) { window.clearTimeout(timeout); setResult({ product, i18n: instance }); }
    }).catch((failure: unknown) => { window.clearTimeout(timeout); if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to open preview."); });
    return () => { window.clearTimeout(timeout); abort.abort(); };
  }, [site, id, language, revision, inspect, published, focus]);
  useEffect(() => {
    if (!result || !result.product || typeof result.product !== "object" || !("_cms_fields" in result.product)) return;
    const fields = result.product._cms_fields as { path: string; value: string; kind: string }[];
    const previewVersion = "_cms_version" in result.product ? result.product._cms_version : undefined;
    const text = new Map(fields.filter((field) => field.kind === "text").map((field) => [field.value, field.path]));
    const images = new Map(fields.filter((field) => field.kind === "image").map((field) => [new URL(field.value, window.location.origin).href, field.path]));
    let focused = false;
    const mark = () => {
      for (const element of document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,p,li,dt,dd,span,img")) {
        if (element.closest("footer,nav") || element.querySelector("h1,h2,h3,h4,p,li,dt,dd")) continue;
        const path = element instanceof HTMLImageElement ? images.get(element.src) : text.get((element.textContent || "").replace(/\s+/g, " ").trim());
        if (path) {
          const target = element.closest<HTMLElement>("button,a") || element;
          target.dataset.cmsField = path;
          if (inspect) {
            target.title = "Edit this field in CMS";
            if (!target.matches("button,a")) { target.tabIndex = 0; target.setAttribute("role", "button"); }
          }
        }
      }
      if (!focused && focus) {
        const target = Array.from(document.querySelectorAll<HTMLElement>("[data-cms-field]")).find((element) => element.dataset.cmsField === focus || element.dataset.cmsField?.startsWith(focus + "."));
        if (target) { focused = true; requestAnimationFrame(() => target.scrollIntoView({ block: "center" })); }
      }
    };
    mark();
    const observer = new MutationObserver(mark);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const select = (event: MouseEvent) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-cms-field]") : null;
      if (!inspect || !element || element.closest("input,textarea,select")) return;
      event.preventDefault(); event.stopPropagation();
      window.parent.postMessage({ type: "cms-preview-field", path: element.dataset.cmsField, version: previewVersion }, window.location.origin);
    };
    document.addEventListener("click", select, true);
    const keyboard = (event: KeyboardEvent) => {
      if (inspect && (event.key === "Enter" || event.key === " ") && event.target instanceof HTMLElement && event.target.dataset.cmsField) {
        event.preventDefault(); event.stopPropagation();
        window.parent.postMessage({ type: "cms-preview-field", path: event.target.dataset.cmsField, version: previewVersion }, window.location.origin);
      }
    };
    document.addEventListener("keydown", keyboard, true);
    const style = document.createElement("style");
    style.textContent = inspect ? "[data-cms-field]{cursor:pointer;scroll-margin:80px;outline:1px dashed #a9cfff88;outline-offset:3px}[data-cms-field]:hover,[data-cms-field]:focus-visible{outline:2px solid #a9cfff;outline-offset:4px}" : "";
    document.head.append(style);
    return () => { observer.disconnect(); document.removeEventListener("click", select, true); document.removeEventListener("keydown", keyboard, true); style.remove(); };
  }, [inspect, result, focus]);
  if (error) return <ErrorMessage message={error} />;
  if (!result) return <Loading label="Loading preview…" />;
  if (kind === "pages") {
    const page = result.product as PagePayload;
    const content = page.slug === "home" ? <Home /> : page.slug === "about-us" ? <AboutUs /> : page.slug === "technology" ? <Technology /> : page.slug === "solutions" ? <Solutions /> : page.slug === "permits-certificates" ? <PermitsCertificates /> : <Support arms={site === "arms"} />;
    return <I18nextProvider i18n={result.i18n}><PageContentProvider site={site} slug={page.slug} previewData={page}><div onClickCapture={(event) => { if (event.target instanceof Element && event.target.closest("a")) event.preventDefault(); }} onSubmitCapture={(event) => { event.preventDefault(); event.stopPropagation(); }}>{site === "ai-def" && <Header />}{content}{site === "ai-def" && <Footer />}</div></PageContentProvider></I18nextProvider>;
  }
  return <I18nextProvider i18n={result.i18n}><div className={site === "arms" ? "store-page text-white" : "text-white"} onSubmitCapture={(event) => { event.preventDefault(); event.stopPropagation(); }} onClickCapture={(event) => {
    if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
  }}>{site === "arms" ? <><StoreHeader products={[result.product as StoreProduct]} readOnly detailPage /><StoreProductPage product={result.product as StoreProduct} relatedProducts={[]} onEnquire={() => undefined} previewLanguage={language} /><StoreFooter /></> : <><Header />{kind === "articles" ? <BlogPost previewData={result.product as ArticlePreviewData} /> : kind === "portal" ? <ClientPortal previewData={result.product as PortalPreviewData} /> : kind === "civil-products" ? <CivilProductDetail previewData={result.product as CivilProductPreviewData} /> : <ProductDetail previewData={result.product as ProductPreviewData} />}<Footer /></>}</div></I18nextProvider>;
}
