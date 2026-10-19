import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { buildLocalizedPath, resolveLanguage } from "../../src/i18n";

export default function StoreFooter() {
  const { t } = useTranslation();
  const { lng } = useParams();
  const storePath = buildLocalizedPath(resolveLanguage(lng), "/store");
  const backToTop = `${storePath}#store-top`;
  const productPath = (productId: string) =>
    buildLocalizedPath(resolveLanguage(lng), `/store/${productId}`);

  return (
    <footer className="border-t-4 border-[#0A1A34] bg-[#16243B] py-20 md:py-24">
      <div className="container-big">
        <div className="mb-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] lg:gap-8">
          <div className="space-y-6">
            <Link to={backToTop} aria-label={t("store.brand")}>
              <img src="/logo-for-footer.svg" className="w-42.5" alt="AI DEF" />
            </Link>
            <div>
              <p className="mt-3 max-w-xs text-sm leading-6 text-foreground/50">{t("store.footer.description")}</p>
              <a href="mailto:arms@ai-def.com" className="mt-4 inline-block text-sm text-foreground/80">arms@ai-def.com</a>
              <p className="mt-3 max-w-xs text-sm leading-6 text-foreground/60">{t("store.footer.inPersonSales")}</p>
            </div>
          </div>

          <div className="flex flex-col space-y-3 text-foreground/70 lg:space-y-5">
            <h2 className="font-bold text-foreground uppercase">{t("store.catalog.kicker")}</h2>
            <Link to={productPath("nyx-guard")}>NYX Guard</Link>
            <Link to={productPath("ar15")}>AR15</Link>
          </div>

          <div className="flex flex-col space-y-3 text-foreground/70 lg:space-y-5">
            <h2 className="font-bold text-foreground uppercase">{t("store.footer.collection")}</h2>
            <Link to={backToTop}>{t("store.navigation.home")}</Link>
            <Link to={buildLocalizedPath(resolveLanguage(lng), "/permits-certificates")}>{t("store.navigation.permitsCertificates")}</Link>
            <a href={backToTop}>{t("store.navigation.top")}</a>
          </div>

          <div className="flex flex-col space-y-3 text-foreground/70 lg:space-y-5">
            <h2 className="font-bold text-foreground uppercase">{t("footer.quickLinks.support")}</h2>
            <Link to={buildLocalizedPath(resolveLanguage(lng), "/store/support#contact")}>{t("store.contact.kicker")}</Link>
            <a href="mailto:servis@ai-def.com">servis@ai-def.com</a>
          </div>

        </div>
        <section className="border-t border-white/10 pt-8">
          <h2 className="font-bold text-foreground uppercase">{t("footer.addresses.title")}</h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-foreground/75">{t("footer.addresses.hqTitle")}</h3>
              <address className="mt-2 text-sm leading-6 text-foreground/50 not-italic">Staničná 267/21, 906 13 Brezová pod Bradlom</address>
            </div>
          </div>
        </section>
      </div>
    </footer>
  );
}
