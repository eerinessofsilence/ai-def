import { PageContentProvider } from "../../components/PageContent";
import { usePageTranslation } from "../../components/PageContent";
import { dispatchOpenContactModal } from "../../lib/contact-modal";

export default function AboutUs() { return <PageContentProvider site="ai-def" slug="about-us"><AboutUsContent /></PageContentProvider>; }

function AboutUsContent() {
  const { t } = usePageTranslation();
  const getArray = <T,>(value: unknown) =>
    Array.isArray(value) ? (value as T[]) : [];
  const lifecyclePhases = getArray<string>(
    t("aboutUs.lifecycle.phases", { returnObjects: true }),
  );
  const heroHighlights = getArray<{ title: string; description: string }>(
    t("aboutUs.hero.highlights", { returnObjects: true }),
  );
  const missionVision = getArray<{ title: string; description: string }>(
    t("aboutUs.missionVision", { returnObjects: true }),
  );
  const lifecycleCards = getArray<{ title: string; description: string }>(
    t("aboutUs.lifecycle.cards", { returnObjects: true }),
  );
  const orgUnits = getArray<{
    title: string;
    description: string;
    bullets: string[];
  }>(t("aboutUs.org.units", { returnObjects: true }));
  const capabilityAreas = getArray<{
    title: string;
    description: string;
    bullets: string[];
  }>(t("aboutUs.capabilities.areas", { returnObjects: true }));
  const peopleAndTraining = getArray<{
    title: string;
    description: string;
    bullets: string[];
  }>(t("aboutUs.people.items", { returnObjects: true }));
  const differentiators = getArray<string>(
    t("aboutUs.differentiators.items", { returnObjects: true }),
  );
  const handleContact = () => dispatchOpenContactModal();

  return (
    <div className="text-foreground">
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 -z-10 mb-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(61,122,215,0.16),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(103,85,227,0.13),transparent_32%),linear-gradient(135deg,#0b172f,#0f1f3c_50%,#0a1426)]" />
          <div className="absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="container max-w-7xl space-y-7.5">
          <div className="text-foreground/70 flex flex-wrap items-center gap-3 font-semibold uppercase">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">
              {t("aboutUs.hero.pill")}
            </span>
          </div>

          <div className="grid items-start gap-10 lg:grid-cols-[1.45fr_1fr]">
            <div className="space-y-7">
              <h1 className="text-6xl leading-tight font-bold text-white max-xl:text-5xl max-md:text-4xl">
                {t("aboutUs.hero.title")}
              </h1>
              <p className="text-lg leading-8 text-white/80 max-md:text-base">
                {t("aboutUs.hero.descriptionPrimary")}
              </p>
              <p className="text-lg leading-8 text-white/80 max-md:text-base">
                {t("aboutUs.hero.descriptionSecondary")}
              </p>
            </div>

            <div className="grid gap-4">
              {heroHighlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_15px_45px_rgba(0,0,0,0.25)] backdrop-blur"
                >
                  <h3 className="text-xl font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/75">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl space-y-8 px-5 pb-16">
        <div className="grid gap-6 md:grid-cols-2">
          {missionVision.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
            >
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70 uppercase">
                <span className="h-1.5 w-6 rounded-full bg-white/70" />
                {item.title}
              </div>
              <p className="text-lg leading-8 text-white/85 max-md:text-base">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto max-w-7xl space-y-6 px-5 pb-16">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_12px_34px_rgba(0,0,0,0.25)]">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white/70 uppercase">
            <span className="border-border/10 rounded-full border bg-white/5 px-3 py-1 backdrop-blur">
              {t("aboutUs.lifecycle.kicker")}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {lifecyclePhases.map((phase, index) => (
              <div className="flex items-center gap-2">
                <div
                  key={phase}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 uppercase shadow-sm shadow-black/25"
                >
                  <span>{phase}</span>
                </div>
                {index !== lifecyclePhases.length - 1 && (
                  <span className="text-white">-&gt;</span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {lifecycleCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <h3 className="text-xl font-semibold text-white">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl space-y-8 px-5 pb-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/60 uppercase">
              {t("aboutUs.org.kicker")}
            </p>
            <h2 className="text-3xl font-bold text-white max-md:text-2xl">
              {t("aboutUs.org.title")}
            </h2>
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70">
            {t("aboutUs.org.badge")}
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {orgUnits.map((unit) => (
            <div
              key={unit.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_10px_32px_rgba(0,0,0,0.18)]"
            >
              <h3 className="text-xl font-semibold text-white">{unit.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/75">
                {unit.description}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                {unit.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/60" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto max-w-7xl space-y-8 px-5 pb-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/60 uppercase">
              {t("aboutUs.capabilities.kicker")}
            </p>
            <h2 className="text-3xl font-bold text-white max-md:text-2xl">
              {t("aboutUs.capabilities.title")}
            </h2>
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70">
            {t("aboutUs.capabilities.badge")}
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {capabilityAreas.map((area) => (
            <div
              key={area.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-white/60 uppercase">
                <span className="h-1.5 w-6 rounded-full bg-white/60" />
                {area.title}
              </div>
              <p className="mt-3 text-sm leading-6 text-white/80">
                {area.description}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                {area.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/55" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto max-w-7xl space-y-8 px-5 pb-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/60 uppercase">
              {t("aboutUs.people.kicker")}
            </p>
            <h2 className="text-3xl font-bold text-white max-md:text-2xl">
              {t("aboutUs.people.title")}
            </h2>
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70">
            {t("aboutUs.people.badge")}
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {peopleAndTraining.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-white/60 uppercase">
                <span className="h-1.5 w-6 rounded-full bg-white/60" />
                {item.title}
              </div>
              <p className="mt-3 text-sm leading-6 text-white/80">
                {item.description}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                {item.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/55" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto max-w-7xl space-y-8 px-5 pb-20">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
          <p className="text-sm font-semibold text-white/60 uppercase">
            {t("aboutUs.differentiators.kicker")}
          </p>
          <h3 className="mt-2 text-3xl font-bold text-white max-md:text-2xl">
            {t("aboutUs.differentiators.title")}
          </h3>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {differentiators.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/15 p-4"
              >
                <span className="mt-1.5 h-2 w-2 rounded-full bg-white/65" />
                <p className="text-sm leading-6 text-white/80">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleContact}
              className="group relative inline-flex h-14 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-white px-8 text-lg font-bold text-black uppercase transition-all duration-300 ease-out will-change-transform hover:shadow-[inset_0_3px_12px_rgba(255,255,255,0.35),inset_0_-6px_20px_rgba(0,0,0,0.45)] active:scale-[0.93] active:shadow-[inset_0_1px_6px_rgba(255,255,255,0.5),inset_0_-8px_22px_rgba(0,0,0,0.65)] max-md:h-12 max-md:text-base"
            >
              {t("aboutUs.differentiators.cta")}
            </button>
            <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75">
              {t("aboutUs.differentiators.note")}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
