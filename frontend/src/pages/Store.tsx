import { lazy, Suspense, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDown, ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import SpotlightCard from "../../components/store/SpotlightCard";
import StoreFooter from "../../components/store/StoreFooter";
import StoreHeader from "../../components/store/StoreHeader";
import TechText from "../../components/store/TechText";
import { buildLocalizedPath, resolveLanguage } from "../i18n";
import { storeProducts, type StoreProduct, type StoreVariant } from "./store-products";
import "./Store.css";

const ContactForm = lazy(() =>
  import("../../components/ui/contact-form").then((module) => ({
    default: module.ContactForm,
  })),
);

const storeHeroStories = storeProducts.map((product) => ({
  category: product.category,
  productId: product.id,
}));
const HERO_STORY_DURATION = 5000;

function ProductImage({ product, hero = false, className = "" }: {
  product: StoreProduct;
  hero?: boolean;
  className?: string;
}) {
  return (
    <img
      src={product.image}
      alt={`${product.brand} ${product.name}`}
      width={product.width}
      height={product.height}
      loading={hero ? "eager" : "lazy"}
      fetchPriority={hero ? "high" : "auto"}
      decoding="async"
      sizes={hero ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"}
      className={`store-product-image ${className}`}
    />
  );
}

function ProductCard({
  product,
  index,
  onSelect,
  description,
  categoryLabel,
  actionLabel,
}: {
  product: StoreProduct;
  index: number;
  onSelect: () => void;
  description: string;
  categoryLabel: string;
  actionLabel: string;
}) {
  return (
    <SpotlightCard
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className="store-product-card group h-full cursor-pointer overflow-hidden rounded-[28px] border border-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <div className="relative flex h-full min-h-[26rem] flex-col p-6 md:min-h-[29rem] md:p-8">
        <div className="relative z-10">
          <p className="store-kicker text-white/45">{String(index + 1).padStart(2, "0")} / {categoryLabel}</p>
        </div>
        <div className="store-product-card-media relative flex flex-1 items-center justify-center py-7">
          <div aria-hidden="true" className="store-product-card-wordmark">
            <span>{product.name}</span>
            <span>{product.name}</span>
            <span>{product.name}</span>
          </div>
          <ProductImage product={product} className="relative z-10 max-h-52 w-full max-w-md transition-transform duration-500 group-hover:scale-[1.035] md:max-h-60" />
        </div>
        <div className="relative z-10 border-t border-white/10 pt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="text-3xl font-semibold tracking-[-0.045em] md:text-4xl">{product.name}</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-white/58">{description}</p>
            </div>
            <span className="store-product-card-action mb-1 shrink-0 text-xs text-white/60 transition-colors group-hover:text-white">{actionLabel}<ChevronRight aria-hidden="true" className="h-4 w-4" /></span>
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}

function StoreProductPage({
  product,
  relatedProducts,
  onSelectProduct,
  onEnquire,
}: {
  product: StoreProduct;
  relatedProducts: StoreProduct[];
  onSelectProduct: (product: StoreProduct) => void;
  onEnquire: (product: StoreProduct, variant: StoreVariant) => void;
}) {
  const { t } = useTranslation();
  const { lng } = useParams();
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const gallery = product.variants.flatMap((variant) =>
    (variant.images.length ? variant.images : [null]).map((image) => ({ image, variant })),
  );
  const activeSlide = gallery[activeIndex] ?? gallery[0];
  const activeVariant = activeSlide.variant;
  const modelName = activeVariant.modelName ?? product.name;
  const specifications = [...product.specifications, ...activeVariant.specifications];
  const imageSrc = activeSlide.image;
  const imageAlt = `${product.brand} ${t(activeVariant.labelKey)}`;
  const storePath = buildLocalizedPath(resolveLanguage(lng), "/store");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${modelName} | ${t("store.pageTitle", { defaultValue: "Arms AI-DEF — Precision in every mission" })}`;
    return () => { document.title = previousTitle; };
  }, [modelName, t]);

  const localizeSpecificationValue = (value: string) => {
    if (resolveLanguage(lng) !== "ru") return value;
    return value
      .replace(/\bmm\b/g, "мм")
      .replace(/\bg\b/g, "г")
      .replace(/\bin\b/g, "дюйма")
      .replace(/(\d),(\d{3})\b/g, "$1 $2")
      .replace(/(\d)\.(\d)/g, "$1,$2");
  };
  const changeSlide = (direction: -1 | 1) => {
    setActiveIndex((index) => (index + direction + gallery.length) % gallery.length);
  };
  const details = [
    { label: t("store.details.model"), value: modelName },
    { label: t("store.details.manufacturer"), value: product.brand },
    { label: t("store.details.category"), value: t(`store.categories.${product.category}`) },
    ...specifications.map((specification) => ({
      label: t(specification.labelKey),
      value: specification.valueKey ? t(specification.valueKey, { count: Number(specification.value) }) : localizeSpecificationValue(specification.value),
    })),
  ];
  const renderVariantSelector = (placement: "mobile" | "desktop") => (
    <fieldset className={placement === "mobile" ? "mt-4 lg:hidden" : "mt-6 hidden lg:block"}>
      <legend className="text-sm font-semibold">{t("store.details.variants")}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {product.variants.map((variant) => (
          <label key={variant.id} className="relative cursor-pointer">
            <input type="radio" name={`variant-${product.id}-${placement}`} value={variant.id} checked={activeVariant.id === variant.id} onChange={() => setActiveIndex(gallery.findIndex((slide) => slide.variant.id === variant.id))} className="peer sr-only" />
            <span className="block rounded-xl border border-white/15 px-3 py-1.5 text-xs leading-5 text-white/65 transition-colors peer-checked:border-sky-200/50 peer-checked:bg-sky-200/10 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white hover:border-white/40">{t(variant.labelKey)}</span>
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-white/55">{t("store.details.variantNote")}</p>
    </fieldset>
  );

  return (
    <main id="store-top" className="container scroll-mt-28 pt-36 pb-24 md:pt-44">
      <Link to={`${storePath}#catalog`} className="mb-8 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />{t("store.details.backToCatalog")}
      </Link>
      <div className="grid gap-y-8 lg:grid-cols-[65%_32.5%] lg:gap-x-[2.5%]">
        <section aria-label={t("store.details.galleryLabel")} className="max-lg:min-w-0">
          <div className="store-detail-gallery store-product-surface relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[28px] border border-[#14243d]/15 p-5 md:aspect-[16/10] md:p-10">
            {imageSrc ? (
              <button type="button" onClick={() => setFullscreenOpen(true)} aria-label={t("store.details.openFullscreen")} className="absolute inset-0 grid cursor-zoom-in place-items-center p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#14243d]/70 md:p-10">
                <img src={imageSrc} alt={imageAlt} decoding="async" className="h-full w-full object-contain" />
              </button>
            ) : <p className="text-center text-sm text-[#14243d]/70">{t("store.details.photoPending")}</p>}
            {gallery.length > 1 ? (
              <>
                <button type="button" onClick={() => changeSlide(-1)} aria-label={t("store.details.previousPhoto")} className="store-round-button absolute top-1/2 left-4 -translate-y-1/2 bg-[#10213a]/80 backdrop-blur"><ChevronLeft aria-hidden="true" className="h-5 w-5" /></button>
                <button type="button" onClick={() => changeSlide(1)} aria-label={t("store.details.nextPhoto")} className="store-round-button absolute top-1/2 right-4 -translate-y-1/2 bg-[#10213a]/80 backdrop-blur"><ChevronRight aria-hidden="true" className="h-5 w-5" /></button>
                <span className="absolute right-4 bottom-4 rounded-full bg-[#10213a]/85 px-3 py-1.5 text-xs text-white/75">{activeIndex + 1} / {gallery.length}</span>
              </>
            ) : null}
            {imageSrc ? <button type="button" onClick={() => setFullscreenOpen(true)} aria-label={t("store.details.openFullscreen")} className="store-round-button absolute top-4 right-4 bg-[#10213a]/80 backdrop-blur"><Maximize2 aria-hidden="true" className="h-4 w-4" /></button> : null}
          </div>
          <p aria-live="polite" className="mt-3 text-sm text-white/65">{t(activeVariant.labelKey)}</p>
          {renderVariantSelector("mobile")}
          {gallery.length > 1 ? (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
              {gallery.map(({ image, variant }, index) => (
                <button key={image ?? variant.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`${t("store.details.selectPhoto", { current: index + 1 })} · ${t(variant.labelKey)}`} aria-pressed={activeIndex === index} className={`store-product-surface w-24 shrink-0 overflow-hidden rounded-xl border p-2 transition-colors lg:w-auto ${activeIndex === index ? "border-[#14243d]/50" : "border-[#14243d]/15 hover:border-[#14243d]/35"}`}>
                  {image ? <img src={image} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full object-contain" /> : <span className="grid aspect-[4/3] place-items-center text-xs text-[#14243d]/70">{t("store.details.photoPending")}</span>}
                </button>
              ))}
            </div>
          ) : null}
          <section className="mt-12 lg:mt-16">
            <h2 className="text-lg font-semibold">{t("store.details.characteristics")}</h2>
            {specifications.length ? (
              <dl className="mt-4 grid overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] md:grid-cols-2">
                {details.map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-5 border-b border-white/10 px-5 py-3 text-sm last:border-b-0 md:odd:border-r md:[&:nth-last-child(-n+2)]:border-b-0">
                    <dt className="text-white/50">{label}</dt><dd className="max-w-[60%] text-right font-medium text-white/85">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-white/55">{t(specifications.length ? "store.details.specificationSource" : "store.details.specificationsPending")}</p>
          </section>
        </section>

        <section className="self-start lg:sticky lg:top-28">
          <div className="flex flex-wrap items-center gap-3">

            <p className="store-kicker">{t(`store.categories.${product.category}`)}</p>
          </div>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight md:text-6xl">{modelName}</h1>
          <p className="mt-4 text-base leading-6 text-white/65">{t(`store.descriptions.${product.id}`)}</p>
          {renderVariantSelector("desktop")}
          <button type="button" onClick={() => onEnquire(product, activeVariant)} className="store-button mt-8 w-full">
            {t("store.actions.enquire")}
          </button>
          <p className="mt-3 text-xs leading-5 text-white/55">{t("store.footer.inPersonSales")}</p>
        </section>
      </div>
      <section className="mt-20 border-t border-white/10 pt-12 md:mt-28 md:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="store-kicker">{t("store.details.relatedKicker")}</p>
            <h2 className="store-section-title mt-3">{t("store.details.relatedTitle")}</h2>
          </div>
          <Link to={`${storePath}#catalog`} className="store-button store-button-small">
            {t("store.details.viewAll")}<ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {relatedProducts.map((relatedProduct) => (
            <button key={relatedProduct.id} type="button" onClick={() => onSelectProduct(relatedProduct)} className="store-card rounded-3xl border border-white/10 bg-white/[0.025] p-5 text-left transition-colors hover:border-white/30 hover:bg-white/[0.05]">

              <div className="store-product-surface mt-3 flex aspect-[4/3] items-center justify-center rounded-2xl p-5"><ProductImage product={relatedProduct} className="max-h-44 w-full" /></div>
              <p className="mt-5 text-[10px] tracking-widest text-white/45 uppercase">{t(`store.categories.${relatedProduct.category}`)}</p>
              <span className="mt-1 flex items-center justify-between gap-4 text-xl font-semibold">{relatedProduct.name}<ChevronRight aria-hidden="true" className="h-5 w-5 text-white/45" /></span>
            </button>
          ))}
        </div>
      </section>
      <Dialog.Root open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-0 z-[160] flex items-center justify-center p-4 outline-none md:p-8">
            <Dialog.Title className="sr-only">{`${product.brand} ${modelName} ${t("store.details.galleryLabel")}`}</Dialog.Title>
            <Dialog.Description className="sr-only">{t(activeVariant.labelKey)}</Dialog.Description>
            <Dialog.Close aria-label={t("store.details.closeFullscreen")} className="store-round-button absolute top-4 right-4 z-10 bg-white/10 text-white hover:bg-white/20"><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close>
            <div className="store-product-surface max-h-[90dvh] max-w-[92vw] rounded-3xl p-4 md:p-8">
              {imageSrc ? <img src={imageSrc} alt={imageAlt} className="max-h-[82dvh] max-w-[86vw] object-contain" /> : <p className="p-12 text-center text-sm text-[#14243d]/70">{t("store.details.photoPending")}</p>}
            </div>
            {gallery.length > 1 ? (
              <>
                <button type="button" onClick={() => changeSlide(-1)} aria-label={t("store.details.previousPhoto")} className="store-round-button absolute top-1/2 left-4 z-10 -translate-y-1/2 bg-white/10 text-white hover:bg-white/20 md:left-8"><ChevronLeft aria-hidden="true" className="h-6 w-6" /></button>
                <button type="button" onClick={() => changeSlide(1)} aria-label={t("store.details.nextPhoto")} className="store-round-button absolute top-1/2 right-4 z-10 -translate-y-1/2 bg-white/10 text-white hover:bg-white/20 md:right-8"><ChevronRight aria-hidden="true" className="h-6 w-6" /></button>
                <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/85">{activeIndex + 1} / {gallery.length}</span>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}

export default function Store() {
  const { t } = useTranslation();
  const { lng, productId, categoryId } = useParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [activeHeroStoryIndex, setActiveHeroStoryIndex] = useState(0);
  const [heroStoryHovered, setHeroStoryHovered] = useState(false);
  const [heroStoryFocused, setHeroStoryFocused] = useState(false);
  const heroStoryPaused = heroStoryHovered || heroStoryFocused;
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSelection, setContactSelection] = useState<{ product: StoreProduct; variant: StoreVariant } | null>(null);
  const contactOpener = useRef<HTMLElement | null>(null);
  const activeHeroStory = storeHeroStories[activeHeroStoryIndex];
  const heroProduct = storeProducts.find((product) => product.id === activeHeroStory.productId)!;
  const detailProduct = storeProducts.find((product) => product.id === productId);
  const categoryProduct = storeProducts.find((product) => product.category === categoryId);
  const visibleRelatedProducts = detailProduct
    ? storeProducts.filter((product) => product.id !== detailProduct.id)
    : [];
  const heroTitle = t("store.hero.title");
  const openProduct = (product: StoreProduct) => {
    navigate(buildLocalizedPath(resolveLanguage(lng), `/store/${product.id}`));
  };
  const openContact = () => {
    setContactSelection(null);
    contactOpener.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setContactOpen(true);
  };
  const openProductContact = (product: StoreProduct, variant: StoreVariant) => {
    setContactSelection({ product, variant });
    contactOpener.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setContactOpen(true);
  };

  useEffect(() => {
    if (detailProduct) return;
    const previousTitle = document.title;
    document.title = t("store.pageTitle", { defaultValue: "Arms AI-DEF — Precision in every mission" });
    return () => { document.title = previousTitle; };
  }, [detailProduct, t]);
  useEffect(() => {
    if (reduceMotion || heroStoryPaused || productId || categoryId) return;
    const timeout = window.setTimeout(() => {
      setActiveHeroStoryIndex((index) => (index + 1) % storeHeroStories.length);
    }, HERO_STORY_DURATION);
    return () => window.clearTimeout(timeout);
  }, [activeHeroStoryIndex, categoryId, heroStoryPaused, productId, reduceMotion]);
  const reveal = {
    initial: reduceMotion ? false as const : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.12 },
    transition: { duration: reduceMotion ? 0 : 0.55 },
  };

  return (
    <div className="store-page text-white">
      <StoreHeader readOnly onContactClick={openContact} detailPage={Boolean(productId || categoryId)} />

      {detailProduct ? <StoreProductPage
        key={detailProduct.id}
        product={detailProduct}
        relatedProducts={visibleRelatedProducts}
        onSelectProduct={openProduct}
        onEnquire={openProductContact}
      /> : productId ? (
        <main id="store-top" className="container pt-36 pb-24 text-white md:pt-44">
          <p className="text-white/65">{t("store.details.unavailable")}</p>
          <Link to={buildLocalizedPath(resolveLanguage(lng), "/store#catalog")} className="store-button mt-6">{t("store.details.backToCatalog")}</Link>
        </main>
      ) : categoryId && categoryProduct ? (
        <Navigate to={buildLocalizedPath(resolveLanguage(lng), `/store/${categoryProduct.id}`)} replace />
      ) : categoryId ? (
        <main id="store-top" className="container pt-36 pb-24 text-white md:pt-44">
          <p className="text-white/65">{t("store.catalog.categoryNotFound")}</p>
          <Link to={buildLocalizedPath(resolveLanguage(lng), "/store#catalog")} className="store-button mt-6">{t("store.details.backToCatalog")}</Link>
        </main>
      ) : <main id="store-top" className="scroll-mt-24 pt-32 md:pt-40">
        <section className="store-hero relative isolate overflow-hidden">
          <div className="container grid min-h-[680px] items-center gap-10 py-20 lg:grid-cols-[0.9fr_1.1fr] max-md:py-12">
            <motion.div {...reveal} className="relative z-10">
              <p className="store-kicker">{t("store.hero.kicker")}</p>
              <h1 className="mt-7 max-w-xl text-5xl leading-[1.08] font-semibold tracking-[-0.045em] text-balance md:text-6xl xl:text-7xl">
                {reduceMotion ? heroTitle : (
                  <>
                    <span className="sr-only">{heroTitle}</span>
                    <TechText
                      key={heroTitle}
                      text={heroTitle}
                      fontSize={72}
                      letterSpacing={-0.045}
                      accentColor="#a9cfff"
                      strokeWidth={1}
                      dashLength={3}
                      dashGap={2}
                      specks={8}
                      labels={false}
                      draggable={false}
                      speed={0.57}
                    />
                  </>
                )}
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-white/60 md:text-lg md:leading-8">{t("store.hero.description")}</p>
              <div className="mt-9 flex flex-wrap items-center gap-6">
                <a href="#catalog" className="store-button">{t("store.hero.cta")}<ArrowDown aria-hidden="true" className="h-4 w-4" /></a>
              </div>
            </motion.div>
            <motion.div {...reveal} onMouseEnter={() => setHeroStoryHovered(true)} onMouseLeave={() => setHeroStoryHovered(false)} onFocusCapture={() => setHeroStoryFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHeroStoryFocused(false); }} className="relative flex min-h-80 flex-col justify-center lg:min-h-[440px]">
              <div aria-hidden="true" className="store-image-halo absolute inset-6" />
              <div role="group" aria-label={t("store.hero.kicker")} className="relative mb-3 flex gap-1.5 px-1">
                {storeHeroStories.map((story, index) => (
                  <button
                    key={story.category}
                    type="button"
                    aria-pressed={activeHeroStoryIndex === index}
                    aria-label={t(`store.categories.${story.category}`)}
                    onClick={() => setActiveHeroStoryIndex(index)}
                    className="h-3 flex-1 cursor-pointer py-1"
                  >
                    <span className="block h-1 overflow-hidden rounded-full bg-white/20">
                      {activeHeroStoryIndex === index ? (
                        <span
                          key={`${activeHeroStoryIndex}-${heroStoryPaused}`}
                          data-paused={heroStoryPaused}
                          className={reduceMotion ? "block h-full w-full rounded-full bg-white" : "store-story-progress block h-full rounded-full bg-white"}
                          style={reduceMotion ? undefined : { animationDuration: `${HERO_STORY_DURATION}ms` }}
                        />
                      ) : index < activeHeroStoryIndex ? <span className="block h-full w-full rounded-full bg-white/70" /> : null}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => openProduct(heroProduct)}
                aria-label={t("store.actions.viewNamed", { name: heroProduct.name })}
                className="store-hero-product store-product-surface relative flex h-64 cursor-pointer items-center justify-center rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-sky-200/80 lg:h-80"
              >
                <motion.div key={activeHeroStoryIndex} initial={reduceMotion ? false : { opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : 0.35 }} className="flex h-full w-full items-center justify-center">
                  <ProductImage product={heroProduct} hero className="max-h-64 w-full" />
                </motion.div>
              </button>
              <div className="relative mt-6 flex items-center justify-between gap-4 border-t border-white/15 pt-5">
                <div><p className="text-xs tracking-widest text-white/45 uppercase">{t(`store.categories.${activeHeroStory.category}`)}</p><p className="mt-1 text-xl font-semibold">{heroProduct?.name ?? t(`store.categories.${activeHeroStory.category}`)}</p></div>
                <span className="text-xs font-medium tracking-widest text-white/45">{String(activeHeroStoryIndex + 1).padStart(2, "0")} / {String(storeHeroStories.length).padStart(2, "0")}</span>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="catalog" className="container scroll-mt-28 py-20 md:py-28">
          <motion.div {...reveal} className="mb-10 flex items-end justify-between gap-6 max-md:flex-col max-md:items-start">
            <div><p className="store-kicker">{t("store.featured.kicker")}</p><h2 className="store-section-title mt-3">{t("store.featured.title")}</h2></div>
          </motion.div>
          <div className="grid gap-5 md:grid-cols-2">
            {storeProducts.map((product, index) => (
              <motion.div {...reveal} key={product.id} className="h-full">
                <ProductCard
                  product={product}
                  index={index}
                  onSelect={() => openProduct(product)}
                  description={t(`store.descriptions.${product.id}`)}
                  categoryLabel={t(`store.categories.${product.category}`)}
                  actionLabel={t("store.actions.details")}
                />
              </motion.div>
            ))}
          </div>
        </section>

      </main>}

      <StoreFooter />

      <Dialog.Root open={contactOpen} onOpenChange={setContactOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="store-dialog-overlay fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm" />
          <Dialog.Content
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              contactOpener.current?.focus();
            }}
            className="store-dialog fixed top-1/2 left-1/2 z-[110] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[28px] border border-neutral-200 bg-white p-6 text-neutral-900 shadow-2xl outline-none md:p-10"
          >
            <Dialog.Title className="sr-only">{t("contactForm.general.title")}</Dialog.Title>
            <Dialog.Description className="sr-only">{t("contactForm.general.description")}</Dialog.Description>
            <Dialog.Close aria-label={t("store.actions.close")} className="absolute top-4 right-4 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-neutral-100 text-neutral-900 transition hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-blue-400">
              <X aria-hidden="true" className="h-4 w-4" />
            </Dialog.Close>
            <Suspense fallback={<div aria-label={t("contactForm.general.loading")} className="min-h-96 animate-pulse rounded-2xl bg-neutral-100" />}>
              <ContactForm
                generalContact
                showDetails={false}
                productSelections={contactSelection ? [{
                  value: `${contactSelection.product.id}-${contactSelection.variant.id}`,
                  label: t(contactSelection.variant.labelKey),
                }] : undefined}
              />
            </Suspense>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}
