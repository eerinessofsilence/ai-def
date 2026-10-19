import { Download, ExternalLink, FileText } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import StoreHeader from "../../components/store/StoreHeader";
import StoreFooter from "../../components/store/StoreFooter";
import { dispatchOpenContactModal } from "../../lib/contact-modal";

const DOCUMENTS = [
  {
    id: "industrialSecurity",
    title: "Potvrdenie o priemyselnej bezpečnosti NBU – AI DEF a.s.",
    href: "/documents/permits/industrial-security-confirmation.pdf",
    type: "PDF",
  },
  {
    id: "ministryPermit",
    title: "Povolenie MH SR s VOP č. PO40-2024-1050",
    href: "/documents/permits/mh-sr-permit-po40-2024-1050.pdf",
    type: "PDF",
  },
  {
    id: "categoryAExemption",
    title: "Rozhodnutie o udelení výnimky na zbrane kat. A",
    href: "/documents/permits/category-a-exemption.pdf",
    type: "PDF",
  },
  {
    id: "categoryAExemptionAmended",
    title: "Rozhodnutie o udelení výnimky na zbrane kat. A – doplnené",
    href: "/documents/permits/category-a-exemption-amended.pdf",
    type: "PDF",
  },
  {
    id: "weaponsLicense",
    title: "P. PZ zbrojná licencia č. LA001308",
    href: "/documents/permits/police-weapons-license-la001308.pdf",
    type: "PDF",
  },
];

export default function PermitsCertificates() {
  const { t } = useTranslation();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t("store.pageTitle", { defaultValue: "Arms AI-DEF — Precision in every mission" });
    return () => { document.title = previousTitle; };
  }, [t]);

  return (
    <div className="store-page text-white">
      <StoreHeader
        cartCount={0}
        onCartClick={dispatchOpenContactModal}
        onContactClick={dispatchOpenContactModal}
        detailPage
        hideCart
      />
      <main className="text-foreground">
      <section className="relative overflow-hidden pt-36 pb-24 max-md:pt-28 max-md:pb-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(61,122,215,0.16),transparent_34%),linear-gradient(135deg,#0b172f,#0f1f3c_50%,#0a1426)]" />
        <div className="container max-w-7xl">
          <p className="mb-4 text-sm font-semibold tracking-[0.16em] text-white/55 uppercase">
            AI DEF
          </p>
          <h1 className="max-w-4xl text-6xl leading-tight font-bold text-white max-xl:text-5xl max-md:text-4xl">
            {t("permitsCertificates.title")}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70 max-md:text-base">
            {t("permitsCertificates.description")}
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {DOCUMENTS.map((document) => (
              <article
                key={document.href}
                className="flex min-h-40 flex-col justify-between gap-6 rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-sm"
              >
                <div className="flex items-start gap-4">
                  <span className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70">
                    <FileText aria-hidden="true" size={22} />
                  </span>
                  <div>
                    <span className="text-xs font-semibold tracking-wider text-white/45 uppercase">
                      {document.type}
                    </span>
                    <h2 className="mt-2 text-lg leading-7 font-semibold text-white">
                      {t(`permitsCertificates.documents.${document.id}`, { defaultValue: document.title })}
                    </h2>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pl-16">
                  <a
                    href={document.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    aria-label={t("permitsCertificates.viewDocument", {
                      document: t(`permitsCertificates.documents.${document.id}`, { defaultValue: document.title }),
                    })}
                  >
                    {t("permitsCertificates.view")}
                    <ExternalLink aria-hidden="true" size={16} />
                  </a>
                  <a
                    href={document.href}
                    download
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#14213b] transition-colors hover:bg-white/85 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    aria-label={t("permitsCertificates.downloadDocument", {
                      document: t(`permitsCertificates.documents.${document.id}`, { defaultValue: document.title }),
                    })}
                  >
                    {t("permitsCertificates.download")}
                    <Download aria-hidden="true" size={16} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      </main>
      <StoreFooter />
    </div>
  );
}
