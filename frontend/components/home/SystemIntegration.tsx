"use client";

import { usePageTranslation } from "../PageContent";
import { ScrollReveal } from "../ui/scroll-reveal";

export default function SystemIntegration() {
  const { t } = usePageTranslation();
  const cards = [
    {
      icon: "system-integration-1.svg",
      title: t("main.systemIntegration.cards.c2.title"),
      description: t("main.systemIntegration.cards.c2.description"),
    },
    {
      icon: "system-integration-2.svg",
      title: t("main.systemIntegration.cards.terminals.title"),
      description: t("main.systemIntegration.cards.terminals.description"),
    },
    {
      icon: "system-integration-3.svg",
      title: t("main.systemIntegration.cards.thirdParty.title"),
      description: t("main.systemIntegration.cards.thirdParty.description"),
    },
  ];

  return (
    <section className="container mx-auto flex flex-col items-center justify-center space-y-25 px-5 py-25 max-lg:space-y-15 max-lg:py-12.5">
      <ScrollReveal
        className="flex flex-col items-center gap-y-10 max-lg:gap-y-5"
        from="down"
        duration={0.5}
        distance={0}
      >
        <h1 className="text-center text-4xl font-semibold lg:text-5xl">
          {t("main.systemIntegration.title")}
        </h1>
        <p className="text-text/75 max-w-4xl text-center text-base text-pretty md:text-lg lg:leading-7.5">
          {t("main.systemIntegration.description")}
        </p>
      </ScrollReveal>
      <div className="grid grid-cols-3 gap-17.5 max-xl:gap-10 max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-5">
        {cards.map((item, index) => (
          <ScrollReveal
            key={item.title}
            delay={index * 0.12}
            duration={0.45}
            ease={[0.33, 1, 0.68, 1]}
          >
            <div className="w-full transition-all duration-300 hover:-translate-y-0.5 hover:scale-105">
              <div className="border-border/15 h-55 w-full rounded-[20px] border-2 bg-white/5 p-5 shadow-lg backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/15 hover:shadow-xl max-md:h-60 max-md:p-7.5">
                <img src={item.icon} className="mb-3 max-w-15" alt="" />
                <h3 className="text-foreground mb-2.5 text-lg font-bold">
                  {item.title}
                </h3>
                <p className="text-foreground/70 capitalize">
                  {item.description}
                </p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
