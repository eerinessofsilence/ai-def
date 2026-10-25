import { PageContentProvider, usePageContent } from "../../components/PageContent";
import { usePageTranslation } from "../../components/PageContent";
import { Link, useParams } from "react-router-dom";
import { buildLocalizedPath, resolveLanguage } from "../i18n";

const CARDS = [
  {
    icon: "/technology-1.svg",
    titleKey: "technology.modules.cards.defgroundPilot.title",
    descriptionKey: "technology.modules.cards.defgroundPilot.description",
  },
  {
    icon: "/technology-2.svg",
    titleKey: "technology.modules.cards.defgroundTargeting.title",
    descriptionKey: "technology.modules.cards.defgroundTargeting.description",
  },
  {
    icon: "/technology-3.svg",
    titleKey: "technology.modules.cards.defgroundGateway.title",
    descriptionKey: "technology.modules.cards.defgroundGateway.description",
  },
  {
    icon: "/technology-4.svg",
    titleKey: "technology.modules.cards.defgroundInstaller.title",
    descriptionKey: "technology.modules.cards.defgroundInstaller.description",
  },
];

export default function Technology() { return <PageContentProvider site="ai-def" slug="technology"><TechnologyContent /></PageContentProvider>; }

function TechnologyContent() {
  const { asset } = usePageContent();
  const { lng } = useParams();
  const currentLanguage = resolveLanguage(lng);
  const { t } = usePageTranslation();
  return (
    <main>
      <section>
        <div className="relative">
          <video
            autoPlay
            loop
            muted
            playsInline
            controls={false}
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
            preload="none"
            src={asset("video", "/technology-video.mp4")}
            className="absolute inset-0 -z-1 h-screen w-full object-cover"
          ></video>

          <div className="container flex h-screen flex-col items-center justify-center gap-10">
            <div className="flex flex-col items-center justify-center gap-2.5">
              <p className="text-foreground/50 text-lg uppercase max-md:text-base lg:tracking-widest">
                {t("technology.hero.kicker")}
              </p>
              <h1 className="text-center text-6xl leading-12 font-bold uppercase max-md:max-w-xs max-md:text-5xl lg:leading-16">
                {t("technology.hero.title")}
              </h1>
            </div>

            <Link
              to={buildLocalizedPath(currentLanguage, "/solutions")}
              className="group relative inline-flex h-14 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-white px-8 text-lg font-bold text-black uppercase transition-all duration-300 ease-out will-change-transform hover:shadow-[inset_0_3px_12px_rgba(255,255,255,0.35),inset_0_-6px_20px_rgba(0,0,0,0.45)] active:scale-[0.93] active:shadow-[inset_0_1px_6px_rgba(255,255,255,0.5),inset_0_-8px_22px_rgba(0,0,0,0.65)] max-md:h-12 max-md:text-base"
            >
              {t("technology.hero.cta")}
            </Link>
          </div>
        </div>
        <div className="flex h-screen w-full items-end justify-end bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${asset("overview", "/technology-bg-1.jpg")})` }}>
          <div className="container">
            <div className="mb-15 space-y-5">
              <h1 className="text-5xl font-bold max-lg:text-4xl max-md:text-center max-md:text-3xl">
                {t("technology.overview.title")}
              </h1>
              <p className="text-foreground/70 text-lg max-md:text-center max-md:text-base max-md:text-balance">
                {t("technology.overview.description")}
              </p>
            </div>
          </div>
        </div>
        <div className="flex min-h-screen w-full items-end justify-end bg-cover bg-center bg-no-repeat py-30 max-md:py-20" style={{ backgroundImage: `url(${asset("modules", "/technology-bg-2.png")})` }}>
          <div className="container">
            <h1 className="mb-25 text-center text-5xl font-bold max-lg:text-4xl max-md:mb-10 max-md:text-center max-md:text-3xl">
              {t("technology.modules.title")}
            </h1>
            <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
              {CARDS.map((item) => (
                <div key={item.titleKey} className="w-full transition-all duration-300 hover:-translate-y-0.5 hover:scale-105">
                  <div className="border-border/15 h-full w-full rounded-[20px] border-2 bg-white/5 p-5 shadow-lg backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/15 hover:shadow-xl">
                    <img src={item.icon} className="mb-3 h-15 w-15" alt="" />
                    <h3 className="text-foreground mb-2.5 text-lg font-bold">
                      {t(item.titleKey)}
                    </h3>
                    <p className="text-foreground/70 capitalize">
                      {t(item.descriptionKey)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex h-screen w-full items-end justify-end bg-[url(/technology-bg-3.jpg)] bg-cover bg-center bg-no-repeat">
          <div className="container">
            <div className="mb-15 space-y-5">
              <h1 className="text-5xl font-bold max-lg:text-4xl max-md:text-center max-md:text-3xl">
                {t("technology.integration.title")}
              </h1>
              <p className="text-foreground/70 text-lg max-md:text-center max-md:text-base max-md:text-balance">
                {t("technology.integration.description")}
              </p>
            </div>
          </div>
        </div>
        <div className="flex h-screen w-full items-end justify-end bg-[url(/technology-bg-4.png)] bg-cover bg-center bg-no-repeat">
          <div className="container">
            <div className="mb-15 space-y-5">
              <h1 className="text-5xl font-bold max-lg:text-4xl max-md:text-center max-md:text-3xl">
                {t("technology.integration.title")}
              </h1>
              <p className="text-foreground/70 text-lg max-md:text-center max-md:text-base max-md:text-balance">
                {t("technology.integration.description")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
