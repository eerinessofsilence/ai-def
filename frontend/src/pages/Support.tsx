import { useEffect, useState } from "react";
import { PageContentProvider, usePageTranslation, usePageContent } from "../../components/PageContent";
import { useLocation } from "react-router-dom";
import { ContactForm } from "../../components/ui/contact-form";
import StoreHeader from "../../components/store/StoreHeader";
import StoreFooter from "../../components/store/StoreFooter";
import "./Store.css";

const backgroundImages = ["/support-1.png", "/support-2.png", "/support-3.png"];

export default function Support({ arms = false }: { arms?: boolean }) { return <PageContentProvider site={arms ? "arms" : "ai-def"} slug="support"><SupportContent arms={arms} /></PageContentProvider>; }

function SupportContent({ arms }: { arms: boolean }) {
  const { asset } = usePageContent();
  const { t } = usePageTranslation();
  const { hash } = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!arms) return;
    const previousTitle = document.title;
    document.title = t("store.pageTitle", { defaultValue: "Arms AI-DEF — Precision in every mission" });
    return () => { document.title = previousTitle; };
  }, [arms, t]);

  useEffect(() => {
    if (arms && hash === "#contact") {
      document.getElementById("contact")?.scrollIntoView();
    }
  }, [arms, hash]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % backgroundImages.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
    {arms ? (
      <StoreHeader
        readOnly
        detailPage
        onContactClick={() => document.getElementById("contact")?.scrollIntoView()}
      />
    ) : null}
    <div className={`flex flex-col gap-16 ${arms ? "store-page text-white" : ""}`}>
      <section className="relative h-screen min-h-[380px] overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          {backgroundImages.map((image, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentSlide ? "opacity-100" : "opacity-0"
              }`}
            >
              <img
                src={asset(`slide${index + 1}`, image || "/placeholder.svg")}
                alt={t("support.hero.slideAlt", { index: index + 1 })}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50" />
            </div>
          ))}
        </div>

        <div className="relative z-10 container flex h-screen items-center justify-center">
          <h1 className="text-center text-6xl leading-12 font-bold text-white max-lg:text-5xl max-md:max-w-xs max-md:text-4xl lg:leading-16">
            {t("support.hero.title")}
          </h1>
        </div>
      </section>

      <section
        id="contact"
        className="container mx-auto scroll-mt-32 space-y-7.5 px-5 pb-24 max-lg:flex max-lg:flex-col max-lg:items-center max-md:pb-16"
      >
        <div className="flex flex-col justify-between gap-10 lg:flex-row">
          <div className="space-y-7.5">
            <div className="space-y-7.5">
              <div>
                <span className="border-border/35 rounded-full border bg-white/5 p-3 px-4 font-semibold uppercase backdrop-blur-lg">
                  {t("support.contact.kicker")}
                </span>
              </div>
              <div className="flex items-center gap-5">
                <div className="border/35 flex h-15 w-15 items-center justify-center rounded-2xl border bg-white/5">
                  <img src="/mail.svg" alt="" />
                </div>
                <a href={`mailto:${arms ? "servis@ai-def.com" : "office@ai-def.com"}`} className="text-lg font-semibold">
                  {arms ? "servis@ai-def.com" : "office@ai-def.com"}
                </a>
              </div>
            </div>
            <div className="space-y-5">
              <p className="text-lg font-semibold uppercase">
                {t("support.contact.addressesLabel")}
              </p>
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <p className="text-foreground/50 font-semibold uppercase md:text-lg">
                    {t("support.contact.hqTitle")}
                  </p>
                  <p className="max-w-[233px] text-pretty md:text-lg">
                    {t("support.contact.hqAddress")}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-start justify-end">
            <div className="relative w-full max-w-4xl">
              <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-white/8 via-white/4 to-white/2 blur-3xl" />
              <div className="relative rounded-3xl border border-white/10 bg-white/10 p-2.5 shadow-2xl backdrop-blur-xl lg:p-5">
                <ContactForm showDetails={false} variant="support" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
    {arms ? <StoreFooter /> : null}
    </>
  );
}
