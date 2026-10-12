import { lazy, startTransition, Suspense, useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import Header from "../components/Header";
import ScrollToTop from "../components/ui/scroll-to-top";
import i18n, {
  buildLocalizedPath,
  DEFAULT_LANGUAGE,
  ensureLanguageResources,
  isSupportedLanguage,
  resolveLanguage,
  stripSupportedLanguageFromPath,
} from "./i18n";
import { ga4PageView } from "./analytics/ga4";
import {
  COOKIE_CONSENT_EVENT,
  getStoredCookieConsent,
  type CookieConsentValue,
} from "../lib/cookie-consent";
import { useInViewOnce } from "../hooks/use-in-view-once";
import Home from "./pages/Home";
import ProductDetail from "./pages/ProductDetail";
const Footer = lazy(() => import("../components/Footer"));
const CookieConsent = lazy(() =>
  import("../components/ui/cookie-consent").then((module) => ({
    default: module.CookieConsent,
  })),
);
const CivilProductDetail = lazy(() => import("./pages/CivilProductDetail"));
const Technology = lazy(() => import("./pages/Technology"));
const TermsOfCondition = lazy(() => import("./pages/TermsOfCondition"));
const PermitsCertificates = lazy(() => import("./pages/PermitsCertificates"));
const Support = lazy(() => import("./pages/Support"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Solutions = lazy(() => import("./pages/Solutions"));
const Auth = lazy(() => import("./pages/Auth"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Store = lazy(() => import("./pages/Store"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <div className="container py-24 max-md:py-16">
      <div className="min-h-[40vh] rounded-[28px] border border-white/12 bg-white/6 backdrop-blur-sm" />
    </div>
  );
}

function LanguageLayout() {
  const { lng } = useParams();
  const location = useLocation();
  const activeLanguage = resolveLanguage(lng);
  const isValidLanguage = lng === undefined || isSupportedLanguage(lng);
  const shouldRedirectDefaultLanguage = lng === DEFAULT_LANGUAGE;
  const [shouldRenderCookieConsent, setShouldRenderCookieConsent] =
    useState(false);
  const { ref: footerSentinelRef, inView: shouldRenderFooter } = useInViewOnce({
    rootMargin: "240px 0px 0px 0px",
  });
  const normalizedPathname = location.pathname.replace(/\/+$/, "") || "/";
  const isHomeRoute =
    stripSupportedLanguageFromPath(normalizedPathname) === "/";
  const normalizedRoutePath = stripSupportedLanguageFromPath(normalizedPathname);
  const isArmsStoreHost =
    typeof window !== "undefined" &&
    window.location.hostname === "arms.ai-def.com";
  const isStoreRoute =
    isArmsStoreHost ||
    normalizedRoutePath === "/store" ||
    normalizedRoutePath.startsWith("/store/") ||
    normalizedRoutePath === "/permits-certificates";

  // i18n
  useEffect(() => {
    if (!isValidLanguage || shouldRedirectDefaultLanguage) return;

    let isCancelled = false;

    const syncLanguage = async () => {
      await ensureLanguageResources(activeLanguage);

      if (!isCancelled && i18n.language !== activeLanguage) {
        await i18n.changeLanguage(activeLanguage);
      }
    };

    void syncLanguage();

    if (typeof document !== "undefined") {
      document.documentElement.lang = activeLanguage;
    }

    return () => {
      isCancelled = true;
    };
  }, [activeLanguage, isValidLanguage, shouldRedirectDefaultLanguage]);

  // GA4
  useEffect(() => {
    if (!isValidLanguage || shouldRedirectDefaultLanguage) return;
    ga4PageView(location.pathname + location.search + location.hash);
  }, [
    isValidLanguage,
    shouldRedirectDefaultLanguage,
    location.pathname,
    location.search,
    location.hash,
  ]);

  useEffect(() => {
    if (
      !isValidLanguage ||
      shouldRedirectDefaultLanguage ||
      typeof window === "undefined"
    ) {
      return;
    }

    const currentPagePath = location.pathname + location.search + location.hash;
    const handleConsentChange = (event: Event) => {
      const consentValue = (event as CustomEvent<CookieConsentValue>).detail;
      if (consentValue === "accepted") {
        ga4PageView(currentPagePath);
      }
    };

    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    return () =>
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
  }, [
    isValidLanguage,
    shouldRedirectDefaultLanguage,
    location.pathname,
    location.search,
    location.hash,
  ]);

  useEffect(() => {
    if (
      !isValidLanguage ||
      shouldRedirectDefaultLanguage ||
      typeof window === "undefined" ||
      getStoredCookieConsent()
    ) {
      return;
    }

    const deferredWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback?: (handle: number) => void;
      };
    let timeoutId: number | null = null;
    let revealed = false;

    const revealCookieConsent = () => {
      if (revealed) {
        return;
      }
      revealed = true;
      startTransition(() => {
        setShouldRenderCookieConsent(true);
      });
    };

    const handleFirstInteraction = () => {
      revealCookieConsent();
    };

    const scheduleCookieConsent = () => {
      timeoutId = deferredWindow.setTimeout(revealCookieConsent, 5000);
      deferredWindow.addEventListener("pointerdown", handleFirstInteraction, {
        once: true,
        passive: true,
      });
      deferredWindow.addEventListener("keydown", handleFirstInteraction, {
        once: true,
      });
      deferredWindow.addEventListener("scroll", handleFirstInteraction, {
        once: true,
        passive: true,
      });
    };

    const handleLoad = () => {
      scheduleCookieConsent();
    };

    if (document.readyState === "complete") {
      scheduleCookieConsent();
    } else {
      deferredWindow.addEventListener("load", handleLoad, { once: true });
    }

    return () => {
      deferredWindow.removeEventListener("load", handleLoad);
      deferredWindow.removeEventListener("pointerdown", handleFirstInteraction);
      deferredWindow.removeEventListener("keydown", handleFirstInteraction);
      deferredWindow.removeEventListener("scroll", handleFirstInteraction);
      if (timeoutId !== null) {
        deferredWindow.clearTimeout(timeoutId);
      }
    };
  }, [isValidLanguage, shouldRedirectDefaultLanguage]);

  if (!isValidLanguage) {
    const segments = location.pathname.split("/").filter(Boolean);
    const fallbackPath =
      segments.length > 1
        ? buildLocalizedPath(
            DEFAULT_LANGUAGE,
            `/${segments.slice(1).join("/")}`,
          )
        : buildLocalizedPath(DEFAULT_LANGUAGE, "/404");
    return (
      <Navigate
        to={{
          pathname: fallbackPath,
          search: location.search,
          hash: location.hash,
        }}
        replace
      />
    );
  }

  if (shouldRedirectDefaultLanguage) {
    return (
      <Navigate
        to={{
          pathname: stripSupportedLanguageFromPath(location.pathname),
          search: location.search,
          hash: location.hash,
        }}
        replace
      />
    );
  }

  return (
    <>
      <ScrollToTop />
      {shouldRenderCookieConsent ? (
        <Suspense fallback={null}>
          <CookieConsent />
        </Suspense>
      ) : null}
      <Header hideChrome={isStoreRoute} />
      <div className="relative min-h-screen">
        {!isHomeRoute && !isStoreRoute ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-1 w-full overflow-hidden"
          >
            <img
              src="/site-bg-top.png"
              className="block h-auto w-full select-none"
              alt=""
              width={3280}
              height={1050}
              sizes="100vw"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              style={{ aspectRatio: "3280 / 1050" }}
            />
            <div className="absolute inset-0 bg-background/30" />
          </div>
        ) : null}
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
        <div
          ref={footerSentinelRef}
          aria-hidden="true"
          className="h-px w-full"
        />
        {!isStoreRoute ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-1 hidden w-full overflow-hidden md:block"
          >
            <img
              src="/site-bg-bottom.png"
              className="block h-auto w-full select-none"
              alt=""
              width={1640}
              height={443}
              sizes="100vw"
              loading="lazy"
              decoding="async"
              style={{ aspectRatio: "1640 / 443" }}
            />
            <div className="absolute inset-0 bg-background/30" />
          </div>
        ) : null}
      </div>
      {shouldRenderFooter && !isStoreRoute ? (
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      ) : null}
    </>
  );
}

function PageRoutes() {
  const isArmsStoreHost =
    typeof window !== "undefined" &&
    window.location.hostname === "arms.ai-def.com";

  return (
    <>
      <Route index element={isArmsStoreHost ? <Store /> : <Home />} />
      <Route path="solutions" element={<Solutions />} />
      <Route path="products/:slug" element={<ProductDetail />} />
      <Route path="store" element={<Store />} />
      <Route path="store/category/:categoryId" element={<Store />} />
      <Route path="store/:productId" element={<Store />} />
      <Route path="civil-products/:slug" element={<CivilProductDetail />} />
      <Route path="technology" element={<Technology />} />
      <Route path="blog" element={<Blog />} />
      <Route path="blog/:post" element={<BlogPost />} />
      <Route path="about-us" element={<AboutUs />} />
      <Route path="terms-of-condition" element={<TermsOfCondition />} />
      <Route
        path="permits-certificates"
        element={<PermitsCertificates />}
      />
      <Route path="support" element={<Support />} />
      <Route path="auth" element={<Auth />} />
      <Route path="client-portal" element={<ClientPortal />} />
      <Route path="*" element={<NotFound />} />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LanguageLayout />}>
        {PageRoutes()}
      </Route>
      <Route path="/:lng" element={<LanguageLayout />}>
        {PageRoutes()}
      </Route>
    </Routes>
  );
}
