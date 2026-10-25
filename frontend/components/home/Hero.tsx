"use client";

import { useEffect, useState } from "react";
import { usePageTranslation, usePageContent } from "../PageContent";
import { dispatchOpenContactModal } from "../../lib/contact-modal";

type HeroMediaSlide = {
  src: string;
  type: "image" | "video";
};

const backgroundSlides: HeroMediaSlide[] = [
  { src: "/hero-bg-video.mov", type: "video" },
  { src: "/hero-bg-1.jpg", type: "image" },
  { src: "/hero-bg-2.jpg", type: "image" },
  { src: "/hero-bg-3.jpg", type: "image" },
  { src: "/hero-bg-4.jpg", type: "image" },
  { src: "/hero-bg-5.jpg", type: "image" },
];

const FADE_DURATION_MS = 1000;
const HERO_IMAGE_WIDTH = 1440;
const HERO_IMAGE_HEIGHT = 900;
const HERO_IMAGE_PROPS = {
  width: HERO_IMAGE_WIDTH,
  height: HERO_IMAGE_HEIGHT,
  sizes: "100vw",
  style: { aspectRatio: `${HERO_IMAGE_WIDTH} / ${HERO_IMAGE_HEIGHT}` },
} as const;

type HeroMediaProps = {
  fetchPriority?: "auto" | "high" | "low";
  index: number;
  isActive: boolean;
  slide: HeroMediaSlide;
};

function HeroMedia({ fetchPriority, index, isActive, slide }: HeroMediaProps) {
  const { t } = usePageTranslation();
  const altText = t("main.hero.slideAlt", { index: index + 1 });

  if (slide.type === "video") {
    return (
      <video
        src={slide.src}
        aria-label={altText}
        className="h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload={isActive ? "auto" : "metadata"}
      />
    );
  }

  return (
    <img
      src={slide.src}
      alt={altText}
      className="h-full w-full object-cover"
      loading="eager"
      fetchPriority={fetchPriority}
      decoding="async"
      {...HERO_IMAGE_PROPS}
    />
  );
}

export default function Hero() {
  const { asset } = usePageContent();
  const slides = backgroundSlides.map((slide, index) => ({ ...slide, src: asset(`hero${index}`, slide.src) }));
  const openContactModal = () => dispatchOpenContactModal();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [nextSlide, setNextSlide] = useState<number | null>(null);
  const [isFading, setIsFading] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const { t } = usePageTranslation();
  const currentMedia = slides[currentSlide] ?? slides[0];
  const nextSlideAltIndex = nextSlide !== null ? nextSlide + 1 : 1;
  const nextMedia =
    nextSlide !== null
      ? (slides[nextSlide] ?? slides[0])
      : null;

  useEffect(() => {
    if (hasUserInteracted || typeof window === "undefined") {
      return;
    }

    const handleFirstInteraction = () => {
      setHasUserInteracted(true);
    };

    window.addEventListener("pointerdown", handleFirstInteraction, {
      once: true,
      passive: true,
    });
    window.addEventListener("touchstart", handleFirstInteraction, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", handleFirstInteraction, {
      once: true,
    });
    window.addEventListener("scroll", handleFirstInteraction, {
      once: true,
      passive: true,
    });

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("scroll", handleFirstInteraction);
    };
  }, [hasUserInteracted]);

  useEffect(() => {
    if (!hasUserInteracted || nextSlide !== null) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNextSlide((currentSlide + 1) % backgroundSlides.length);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [currentSlide, hasUserInteracted, nextSlide]);

  useEffect(() => {
    if (nextSlide === null || nextSlide === currentSlide) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsFading(true);
    });
    const timer = window.setTimeout(() => {
      setCurrentSlide(nextSlide);
      setNextSlide(null);
      setIsFading(false);
    }, FADE_DURATION_MS);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [currentSlide, nextSlide]);

  useEffect(() => {
    if (!hasUserInteracted) {
      return;
    }

    const baseSlide = nextSlide ?? currentSlide;
    const nextSlideIndex = (baseSlide + 1) % backgroundSlides.length;
    const nextMediaToPreload = backgroundSlides[nextSlideIndex];

    if (nextMediaToPreload?.type === "image") {
      const preloadImage = new Image();
      preloadImage.src = nextMediaToPreload.src;
    } else if (nextMediaToPreload?.type === "video") {
      const preloadVideo = document.createElement("video");
      preloadVideo.preload = "metadata";
      preloadVideo.src = nextMediaToPreload.src;
    }
  }, [currentSlide, hasUserInteracted, nextSlide]);

  return (
    <section className="relative flex h-screen items-center max-lg:h-[75vh] max-sm:h-screen">
      <div className="absolute inset-0 overflow-hidden">
        {nextMedia ? (
          <div className="absolute inset-0">
            <HeroMedia
              index={nextSlideAltIndex - 1}
              isActive={false}
              slide={nextMedia}
            />
            <div className="absolute inset-0 bg-black/50" />
          </div>
        ) : null}

        <div
          className={`absolute inset-0 ${
            nextMedia ? "transition-opacity duration-1000" : ""
          } ${nextMedia && isFading ? "opacity-0" : "opacity-100"}`}
          aria-hidden={nextMedia ? "true" : undefined}
        >
          <HeroMedia
            index={currentSlide}
            isActive
            slide={currentMedia}
            fetchPriority={currentSlide === 0 ? "high" : "auto"}
          />
          <div className="absolute inset-0 bg-black/50" />
        </div>
      </div>

      <div className="relative z-10 container mx-auto mt-22.5">
        <div className="flex justify-center">
          <div className="flex max-w-4xl flex-col items-center justify-center gap-10">
            <div className="flex flex-col items-center gap-2 md:gap-4 lg:gap-6">
              <h1 className="text-text text-center text-4xl font-bold text-balance max-md:leading-11 md:text-5xl lg:text-6xl lg:leading-22 xl:text-7xl">
                {t("main.hero.title")}
              </h1>
              <p className="text-text/75 max-w-sm text-center leading-6.5 text-pretty md:max-w-3xl md:text-lg md:leading-8 lg:text-xl">
                {t("main.hero.description")}
              </p>
            </div>
            <a
              onClick={openContactModal}
              className="group relative inline-flex h-14 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-white px-8 text-lg font-bold text-black uppercase transition-all duration-300 ease-out will-change-transform hover:shadow-[inset_0_3px_12px_rgba(255,255,255,0.35),inset_0_-6px_20px_rgba(0,0,0,0.45)] active:scale-[0.93] active:shadow-[inset_0_1px_6px_rgba(255,255,255,0.5),inset_0_-8px_22px_rgba(0,0,0,0.65)] max-md:h-12 max-md:text-base"
            >
              {t("main.hero.cta")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
