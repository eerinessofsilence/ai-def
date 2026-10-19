import { useState } from "react";
import { ChevronDown, Menu, ShoppingBag, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  buildLocalizedPath,
  replaceLanguageInPath,
  resolveLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "../../src/i18n";
import { storeProducts } from "../../src/pages/store-products";

const languages: Record<SupportedLanguage, { image: string }> = {
  en: { image: "/languages/en.svg" },
  de: { image: "/languages/de.svg" },
  sk: { image: "/languages/sk.svg" },
  es: { image: "/languages/es.svg" },
  fr: { image: "/languages/fr.svg" },
  it: { image: "/languages/it.svg" },
  ru: { image: "/languages/ru.svg" },
};

type StoreHeaderProps = {
  cartCount?: number;
  onCartClick?: () => void;
  onContactClick?: () => void;
  detailPage?: boolean;
  hideCart?: boolean;
  readOnly?: boolean;
};

export default function StoreHeader({ cartCount = 0, onCartClick, onContactClick, detailPage = false, hideCart = false, readOnly = false }: StoreHeaderProps) {
  const { t } = useTranslation();
  const { lng } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const currentLanguage = resolveLanguage(lng);
  const storePath = buildLocalizedPath(currentLanguage, "/store");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);
  const navItems = [
    { href: "#store-top", label: t("store.navigation.home") },
    { href: "#catalog", label: t("store.catalog.kicker") },
    {
      href: "/permits-certificates",
      label: t("store.navigation.permitsCertificates"),
    },
  ];

  const selectLanguage = (language: SupportedLanguage) => {
    navigate({
      pathname: replaceLanguageInPath(location.pathname, language),
      search: location.search,
      hash: location.hash,
    });
    setLanguageOpen(false);
    setMobileOpen(false);
  };

  return (
    <div className="fixed left-1/2 z-50 container -translate-x-1/2 py-5">
      <header className="border border-white/25 rounded-[20px] bg-linear-to-b from-black/50 via-black/40 to-black/30 px-4 py-4 shadow-[inset_0_2px_8px_rgba(255,255,255,0.25)] backdrop-blur-xl md:px-5 md:py-5">
        <div className="flex items-center justify-between gap-2 md:gap-3">
          <Link to={storePath} aria-label={t("store.navigation.top")} className="flex shrink-0 items-center">
            <img src="/logo-ai-def.svg" className="w-24 md:w-35" alt="AI DEF" width={140} height={38} />
          </Link>

          <nav aria-label={t("store.navigation.label")} className="hidden items-center gap-5 xl:flex">
            {navItems.map((item) => item.href === "#catalog" ? (
              <div
                key={item.href}
                className="relative py-2"
                onMouseEnter={() => setCatalogOpen(true)}
                onMouseLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) setCatalogOpen(false); }}
                onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setCatalogOpen(false); }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setCatalogOpen(false);
                    event.currentTarget.querySelector("button")?.focus();
                  }
                }}
              >
                <button type="button" aria-expanded={catalogOpen} onClick={() => setCatalogOpen(true)} className="inline-flex cursor-pointer items-center gap-1 font-medium text-foreground transition-colors hover:text-foreground/75 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70">
                  {item.label}<ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${catalogOpen ? "rotate-180" : ""}`} />
                </button>
                {catalogOpen ? (
                  <div className="absolute top-full left-1/2 z-40 w-[min(25rem,calc(100vw-2rem))] -translate-x-1/2 pt-3">
                    <div className="rounded-[20px] bg-[#ececec] p-5 shadow-sm shadow-black/25">
                      <div className="grid grid-cols-2 gap-5">
                        {storeProducts.map((product) => (
                          <Link key={product.id} to={buildLocalizedPath(currentLanguage, `/store/${product.id}`)} onClick={() => setCatalogOpen(false)} className="group flex min-w-0 flex-col items-center overflow-hidden rounded-xl bg-white text-center transition-all duration-300 hover:scale-[1.03] hover:shadow-sm hover:shadow-black/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600">
                            <img src={product.image} alt="" loading="lazy" decoding="async" className="h-30 w-full p-3 object-contain" />
                            <span className="flex min-h-14 items-center px-2 text-sm font-semibold text-black">{product.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : item.href.startsWith("/") ? (
              <Link
                key={item.href}
                to={buildLocalizedPath(currentLanguage, item.href)}
                className="font-medium text-foreground transition-colors hover:text-foreground/75"
              >
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={detailPage ? `${storePath}${item.href}` : item.href} className="font-medium text-foreground transition-colors hover:text-foreground/75">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 md:gap-4">
            <div className="relative hidden xl:block" onMouseEnter={() => setLanguageOpen(true)} onMouseLeave={() => setLanguageOpen(false)}>
              <button
                type="button"
                aria-label={t("store.navigation.language")}
                aria-expanded={languageOpen}
                onClick={() => setLanguageOpen((open) => !open)}
                className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] border border-white/25 bg-linear-to-br from-black/20 via-black/10 to-black/0 backdrop-blur-lg transition-all duration-300 hover:shadow-[inset_0_2px_6px_rgba(255,255,255,0.25)] active:scale-[0.93]"
              >
                <img src="/language-icon.svg" className="h-4.5 w-4.5" alt="" width={18} height={18} />
                <span className="absolute -right-1.5 -bottom-1.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] leading-none font-bold text-black shadow-sm">
                  {currentLanguage.toUpperCase()}
                </span>
              </button>
              <div aria-hidden={!languageOpen} className={`absolute top-full right-0 z-30 w-[min(42rem,calc(100vw-2rem))] rounded-[20px] bg-[#f5f5f5] shadow-sm shadow-black/25 transition-all duration-300 ${languageOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}>
                <div className="grid grid-cols-3 gap-4 p-4 md:gap-6 md:p-5">
                  {SUPPORTED_LANGUAGES.map((language) => {
                    const item = languages[language];
                    const active = language === currentLanguage;
                    return (
                      <button
                        key={language}
                        type="button"
                        onClick={() => selectLanguage(language)}
                        aria-current={active ? "true" : undefined}
                        className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition-colors ${active ? "bg-[#d5d5d5]/60 shadow-inner ring-1 ring-black/15" : "hover:bg-[#c4c4c4]/35"}`}
                      >
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-md shadow-black/25 md:h-15 md:w-15">
                          <img src={item.image} className="h-7.5 w-7.5" alt="" width={30} height={30} />
                        </span>
                        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-black">
                          <span className="truncate">{language === "ru" ? "Русский" : t(`header.languages.${language}`)}</span>
                          {active ? <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.22)]" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {!readOnly && !hideCart && onCartClick ? <button
              type="button"
              onClick={onCartClick}
              aria-label={t("store.cart.open", { count: cartCount })}
              className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] border border-white/25 bg-linear-to-br from-black/20 via-black/10 to-black/0 text-white backdrop-blur-lg transition-all duration-300 hover:shadow-[inset_0_2px_6px_rgba(255,255,255,0.25)] active:scale-[0.93]"
            >
              <ShoppingBag aria-hidden="true" className="h-5 w-5" />
              {cartCount > 0 ? <span className="absolute -right-1.5 -bottom-1.5 min-w-5 rounded-full bg-white px-1 py-0.5 text-center text-[10px] leading-none font-bold text-black shadow-sm">{cartCount}</span> : null}
            </button> : null}

            {onContactClick ? <button type="button" onClick={onContactClick} className="max-w-26 rounded-xl bg-white px-2.5 py-2.5 text-xs font-semibold wrap-break-word text-[#14243d] transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:max-w-none md:px-5 md:py-3 md:text-sm">
              {t("store.contact.kicker")}
            </button> : null}

            <button type="button" onClick={() => setMobileOpen((open) => !open)} aria-label={t(mobileOpen ? "store.actions.close" : "store.navigation.openMenu")} aria-expanded={mobileOpen} className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] border border-white/25 bg-white/5 text-white xl:hidden">
              {mobileOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <nav aria-label={t("store.navigation.label")} className="mt-5 flex flex-col gap-1 border-t border-white/15 pt-4 xl:hidden">
            {navItems.map((item) => item.href === "#catalog" ? (
              <div key={item.href}>
                <button type="button" onClick={() => setMobileCatalogOpen((open) => !open)} aria-expanded={mobileCatalogOpen} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-base font-medium text-white/90 transition-colors hover:bg-white/10">
                  {item.label}<ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${mobileCatalogOpen ? "rotate-180" : ""}`} />
                </button>
                {mobileCatalogOpen ? (
                  <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-black/15 p-2">
                    {storeProducts.map((product) => {
                      const href = buildLocalizedPath(currentLanguage, `/store/${product.id}`);
                      return (
                        <Link key={product.id} to={href} onClick={() => { setMobileOpen(false); setMobileCatalogOpen(false); }} className="flex min-w-0 flex-col gap-2 rounded-lg p-2 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white">
                          <span className="grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-md bg-white/[0.06] p-1">
                            <img src={product.image} alt="" className="h-full w-full object-contain" />
                          </span>
                          <span className="truncate">{product.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : item.href.startsWith("/") ? (
              <Link
                key={item.href}
                to={buildLocalizedPath(currentLanguage, item.href)}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={detailPage ? `${storePath}${item.href}` : item.href} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 text-base font-medium text-white/90 transition-colors hover:bg-white/10">{item.label}</a>
            ))}
            <p className="mt-3 px-3 text-xs font-semibold tracking-wide text-white/55 uppercase">{t("store.navigation.language")}</p>
            <div className="grid grid-cols-2 gap-2 px-2 pt-2 sm:grid-cols-3">
              {SUPPORTED_LANGUAGES.map((language) => {
                const item = languages[language];
                const active = language === currentLanguage;
                return <button key={language} type="button" onClick={() => selectLanguage(language)} aria-current={active ? "true" : undefined} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${active ? "border-emerald-300/70 bg-white/15" : "border-white/10 bg-white/5"}`}><img src={item.image} className="h-7 w-7" alt="" width={28} height={28} /><span>{language === "ru" ? "Русский" : t(`header.languages.${language}`)}</span></button>;
              })}
            </div>
          </nav>
        ) : null}
      </header>
    </div>
  );
}
