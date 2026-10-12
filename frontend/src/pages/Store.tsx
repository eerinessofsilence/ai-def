import { lazy, Suspense, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDown, ChevronLeft, ChevronRight, ChevronsUpDown, Maximize2, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import SpotlightCard from "../../components/store/SpotlightCard";
import StoreFooter from "../../components/store/StoreFooter";
import StoreHeader from "../../components/store/StoreHeader";
import TechText from "../../components/store/TechText";
import { buildLocalizedPath, resolveLanguage } from "../i18n";
import { storeCategories, storeProducts, type StoreCategory, type StoreProduct } from "./store-products";
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

function StoreProductPage({
  product,
  relatedProducts,
  onSelectProduct,
}: {
  product: StoreProduct;
  relatedProducts: StoreProduct[];
  onSelectProduct: (product: StoreProduct) => void;
}) {
  const { t } = useTranslation();
  const { lng } = useParams();
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const activeVariant = product.variants.find((variant) => variant.id === variantId) ?? product.variants[0];
  const gallery = activeVariant.images;
  const imageSrc = gallery[activeIndex] ?? gallery[0] ?? product.image;
  const imageAlt = `${product.brand} ${product.name} · ${t(activeVariant.labelKey)}`;
  const storePath = buildLocalizedPath(resolveLanguage(lng), "/store");
  const changeSlide = (direction: -1 | 1) => {
    setActiveIndex((index) => (index + direction + gallery.length) % gallery.length);
  };
  const details = [
    { label: t("store.details.model"), value: product.name },
    { label: t("store.details.manufacturer"), value: product.brand },
    { label: t("store.details.category"), value: t(`store.categories.${product.category}`) },
    ...product.specifications.map((specification) => ({
      label: t(specification.labelKey),
      value: specification.valueKey ? t(specification.valueKey, { count: Number(specification.value) }) : specification.value,
    })),
  ];

  return (
    <main id="store-top" className="container scroll-mt-28 pt-36 pb-24 md:pt-44">
      <Link to={`${storePath}#catalog`} className="mb-8 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />{t("store.details.backToCatalog")}
      </Link>
      <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:gap-14">
        <section aria-label={t("store.details.galleryLabel")}>
          <div className="store-detail-gallery relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-[#10213a] p-5 md:aspect-[16/10] md:p-10">
            <button type="button" onClick={() => setFullscreenOpen(true)} aria-label={t("store.details.openFullscreen")} className="absolute inset-0 grid cursor-zoom-in place-items-center p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 md:p-10">
              <img src={imageSrc} alt={imageAlt} decoding="async" className="h-full w-full object-contain" />
            </button>
            {gallery.length > 1 ? (
              <>
                <button type="button" onClick={() => changeSlide(-1)} aria-label={t("store.details.previousPhoto")} className="store-round-button absolute top-1/2 left-4 -translate-y-1/2 bg-[#10213a]/80 backdrop-blur"><ChevronLeft aria-hidden="true" className="h-5 w-5" /></button>
                <button type="button" onClick={() => changeSlide(1)} aria-label={t("store.details.nextPhoto")} className="store-round-button absolute top-1/2 right-4 -translate-y-1/2 bg-[#10213a]/80 backdrop-blur"><ChevronRight aria-hidden="true" className="h-5 w-5" /></button>
                <span className="absolute right-4 bottom-4 rounded-full bg-[#10213a]/85 px-3 py-1.5 text-xs text-white/75">{activeIndex + 1} / {gallery.length}</span>
              </>
            ) : null}
            <button type="button" onClick={() => setFullscreenOpen(true)} aria-label={t("store.details.openFullscreen")} className="store-round-button absolute top-4 right-4 bg-[#10213a]/80 backdrop-blur"><Maximize2 aria-hidden="true" className="h-4 w-4" /></button>
          </div>
          {gallery.length > 1 ? (
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {gallery.map((image, index) => (
                <button key={image} type="button" onClick={() => setActiveIndex(index)} aria-label={t("store.details.selectPhoto", { current: index + 1 })} aria-pressed={activeIndex === index} className={`overflow-hidden rounded-xl border bg-[#10213a] p-2 transition-colors ${activeIndex === index ? "border-white/60" : "border-white/10 hover:border-white/30"}`}>
                  <img src={image} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full object-contain" />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="self-center">
          <div className="flex flex-wrap items-center gap-3">

            <p className="store-kicker">{product.brand} / {t(`store.categories.${product.category}`)}</p>
          </div>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight md:text-6xl">{product.name}</h1>
          <p className="mt-6 text-base leading-8 text-white/65">{t(`store.descriptions.${product.id}`)}</p>
          <fieldset className="mt-8">
            <legend className="text-sm font-semibold">{t("store.details.variants")}</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.variants.map((variant) => (
                <label key={variant.id} className="relative cursor-pointer">
                  <input type="radio" name={`variant-${product.id}`} value={variant.id} checked={variantId === variant.id} onChange={() => { setVariantId(variant.id); setActiveIndex(0); }} className="peer sr-only" />
                  <span className="block rounded-xl border border-white/15 px-3 py-2 text-xs leading-5 text-white/65 transition-colors peer-checked:border-sky-200/50 peer-checked:bg-sky-200/10 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white hover:border-white/40">{t(variant.labelKey)}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-white/45">{t("store.details.variantNote")}</p>
          </fieldset>
          <div className="mt-9">
            <h2 className="text-lg font-semibold">{t("store.details.characteristics")}</h2>
            <dl className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.025] px-5">
              {details.map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-5 py-4 text-sm">
                  <dt className="text-white/50">{label}</dt><dd className="max-w-[60%] text-right font-medium text-white/85">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-5 text-white/45">{t(product.specifications.length ? "store.details.specificationSource" : "store.details.specificationsPending")}</p>
          </div>
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

              <div className="mt-3 flex aspect-[4/3] items-center justify-center rounded-2xl bg-[#10213a] p-5"><ProductImage product={relatedProduct} className="max-h-44 w-full" /></div>
              <p className="mt-5 text-[10px] tracking-widest text-white/45 uppercase">{relatedProduct.brand}</p>
              <span className="mt-1 flex items-center justify-between gap-4 text-xl font-semibold">{relatedProduct.name}<ChevronRight aria-hidden="true" className="h-5 w-5 text-white/45" /></span>
            </button>
          ))}
        </div>
      </section>
      <Dialog.Root open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-0 z-[160] flex items-center justify-center p-4 outline-none md:p-8">
            <Dialog.Title className="sr-only">{`${product.brand} ${product.name} ${t("store.details.galleryLabel")}`}</Dialog.Title>
            <Dialog.Description className="sr-only">{t(activeVariant.labelKey)}</Dialog.Description>
            <Dialog.Close aria-label={t("store.details.closeFullscreen")} className="store-round-button absolute top-4 right-4 z-10 bg-white/10 text-white hover:bg-white/20"><X aria-hidden="true" className="h-5 w-5" /></Dialog.Close>
            <img src={imageSrc} alt={imageAlt} className="max-h-[90dvh] max-w-[92vw] object-contain" />
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

function StoreCategoryPage({
  category,
  products,
  onSelectProduct,
}: {
  category: StoreCategory;
  products: StoreProduct[];
  onSelectProduct: (product: StoreProduct) => void;
}) {
  const { t } = useTranslation();
  const { lng } = useParams();
  const reduceMotion = useReducedMotion();
  const [sortOrder, setSortOrder] = useState<"relevance" | "name">("relevance");
  const visibleProducts = products;
  const sortedProducts = sortOrder === "name"
    ? [...visibleProducts].sort((first, second) => first.name.localeCompare(second.name))
    : visibleProducts;
  const storePath = buildLocalizedPath(resolveLanguage(lng), "/store");

  return (
    <main id="store-top" className="container pt-36 pb-24 md:pt-44">
      <Link
        to={`${storePath}#catalog`}
        className="mb-8 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
      >
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        {t("store.details.backToCatalog")}
      </Link>
      <div className="mb-10 flex items-end justify-between gap-6 max-md:flex-col max-md:items-start">
        <div>
          <p className="store-kicker">{t("store.catalog.kicker")}</p>
          <h1 className="store-section-title mt-3">
            {t(`store.categories.${category}`)}
          </h1>
          <p className="mt-3 text-sm text-white/55">
            {t("store.catalog.modelCount", { count: visibleProducts.length })}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <label className="flex min-w-0 flex-1 items-center gap-4 md:flex-none">
            <span className="shrink-0 text-sm text-white/55">{t("store.catalog.sortBy")}</span>
            <span className="relative min-w-0 flex-1 md:flex-none">
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as "relevance" | "name")}
                className="min-h-11 w-full min-w-0 appearance-none rounded-full border border-white/15 bg-[#172b4a] py-2 pl-4 pr-11 text-base text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:w-40"
              >
                <option value="relevance">{t("store.catalog.sortRelevance")}</option>
                <option value="name">{t("store.catalog.sortName")}</option>
              </select>
              <ChevronsUpDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 text-white/80" />
            </span>
          </label>
        </div>
      </div>

      {visibleProducts.length ? (
        <motion.div
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {sortedProducts.map((product, index) => (
            <SpotlightCard
              key={product.id}
              className="store-card overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] tracking-widest text-white/40 uppercase">
                  {t(`store.categories.${product.category}`)}
                </span>
                <span className="text-xs text-white/50">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <button type="button" onClick={() => onSelectProduct(product)} aria-label={`${t("store.actions.details")}: ${product.name}`} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70">
                <div className="relative flex aspect-[4/3] items-center justify-center py-7">
                  <ProductImage product={product} className="max-h-44 w-full" />
                </div>
              </button>
              <div className="border-t border-white/10 pt-5">
                <p className="text-[10px] tracking-widest text-white/40 uppercase">{product.brand}</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <button type="button" onClick={() => onSelectProduct(product)} className="truncate text-left text-2xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-white/70">
                    {product.name}
                  </button>

                </div>
                <button type="button" onClick={() => onSelectProduct(product)} className="mt-4 text-xs text-white/45 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-white/70">
                  {t("store.actions.details")}
                </button>
              </div>
            </SpotlightCard>
          ))}
        </motion.div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-sm leading-7 text-white/60">
          {t("store.catalog.accessoriesComingSoon")}
        </div>
      )}
    </main>
  );
}

export default function Store() {
  const { t } = useTranslation();
  const { lng, productId, categoryId } = useParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [activeHeroStoryIndex, setActiveHeroStoryIndex] = useState(0);
  const [heroStoryPaused, setHeroStoryPaused] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const contactOpener = useRef<HTMLElement | null>(null);
  const activeHeroStory = storeHeroStories[activeHeroStoryIndex];
  const heroProduct = storeProducts.find((product) => product.id === activeHeroStory.productId)!;
  const detailProduct = storeProducts.find((product) => product.id === productId);
  const activeCategory = storeCategories.find((category) => category === categoryId);
  const visibleRelatedProducts = detailProduct
    ? storeProducts.filter((product) => product.id !== detailProduct.id)
    : [];
  const heroTitle = t("store.hero.title");
  const featuredProducts = storeProducts;
  const categoryProducts = activeCategory
    ? storeProducts.filter((product) => product.category === activeCategory)
    : [];
  const openProduct = (product: StoreProduct) => {
    navigate(buildLocalizedPath(resolveLanguage(lng), `/store/${product.id}`));
  };
  const openContact = () => {
    contactOpener.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setContactOpen(true);
  };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = detailProduct
      ? `${detailProduct.name} | ${detailProduct.brand}`
      : activeCategory
        ? `${t(`store.categories.${activeCategory}`)} | ${t("store.brand")}`
        : `${t("store.brand")} | ${t("store.catalog.kicker")}`;
    return () => { document.title = previousTitle; };
  }, [activeCategory, detailProduct, t]);
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
      /> : productId ? (
        <main id="store-top" className="container pt-36 pb-24 text-white md:pt-44">
          <p className="text-white/65">{t("store.details.unavailable")}</p>
          <Link to={buildLocalizedPath(resolveLanguage(lng), "/store#catalog")} className="store-button mt-6">{t("store.details.backToCatalog")}</Link>
        </main>
      ) : categoryId && activeCategory ? (
        <StoreCategoryPage
          category={activeCategory}
          products={categoryProducts}
          onSelectProduct={openProduct}
        />
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
                <a href="#featured" className="store-text-link">{t("store.actions.exploreFeatured")}</a>
              </div>
            </motion.div>
            <motion.div {...reveal} onMouseEnter={() => setHeroStoryPaused(true)} onMouseLeave={() => setHeroStoryPaused(false)} className="relative flex min-h-80 flex-col justify-center lg:min-h-[440px]">
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-3 text-center text-[clamp(5rem,13vw,13rem)] leading-none font-bold tracking-[-0.08em] text-white/[0.035]">{heroProduct.name}</span>
              <div aria-hidden="true" className="store-image-halo absolute inset-6" />
              <div role="tablist" aria-label={t("store.hero.kicker")} className="relative mb-3 flex gap-1.5 px-1">
                {storeHeroStories.map((story, index) => (
                  <button
                    key={story.category}
                    type="button"
                    role="tab"
                    aria-selected={activeHeroStoryIndex === index}
                    aria-label={t(`store.categories.${story.category}`)}
                    onClick={() => setActiveHeroStoryIndex(index)}
                    className="h-3 flex-1 cursor-pointer py-1"
                  >
                    <span className="block h-1 overflow-hidden rounded-full bg-white/20">
                      {activeHeroStoryIndex === index ? (
                        <span
                          key={activeHeroStoryIndex}
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
                className="store-hero-product relative flex h-64 cursor-pointer items-center justify-center rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:h-80"
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

        <section id="featured" className="container scroll-mt-28 py-20 md:py-28">
          <motion.div {...reveal} className="mb-10 flex items-end justify-between gap-6 max-md:flex-col max-md:items-start">
            <div><p className="store-kicker">{t("store.featured.kicker")}</p><h2 className="store-section-title mt-3">{t("store.featured.title")}</h2></div>
          </motion.div>
          <div className="grid gap-5 md:grid-cols-2">
            {featuredProducts.map((product, index) => (
              <SpotlightCard {...reveal} key={product.id} role="button" tabIndex={0} onClick={() => openProduct(product)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openProduct(product); } }} className={`store-feature relative isolate cursor-pointer overflow-hidden rounded-[28px] border border-white/10 p-7 outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:p-10 ${index === 0 ? "md:col-span-2 md:grid md:grid-cols-[0.8fr_1.2fr] md:items-center" : "md:col-span-2 flex flex-col"}`}>
                <div className={`relative z-10 ${index === 0 ? "max-w-sm" : "flex items-start justify-between gap-5"}`}>
                  <div>

                    <p className="store-kicker text-white/40">0{index + 1} / {t(`store.categories.${product.category}`)}</p>
                    <h3 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">{product.name}</h3>
                    <p className="mt-2 text-xs tracking-widest text-white/40 uppercase">{product.brand}</p>
                    {index === 0 ? <p className="mt-5 text-sm leading-7 text-white/60">{t(`store.descriptions.${product.id}`)}</p> : null}
                  </div>
                </div>
                <div className={`relative flex items-center justify-center rounded-2xl ${index === 0 ? "h-60 max-md:mt-8 md:h-80" : "mt-6 h-60"}`}>
                  <span aria-hidden="true" className="pointer-events-none absolute text-[clamp(5rem,10vw,10rem)] font-semibold tracking-tighter text-white/[0.035]">{product.name}</span>
                  <ProductImage product={product} className="relative max-h-56 w-full max-w-xl" />
                </div>
                {index > 0 ? <p className="mt-5 border-t border-white/10 pt-5 text-sm leading-6 text-white/55">{t(`store.descriptions.${product.id}`)}</p> : null}
              </SpotlightCard>
            ))}
          </div>
        </section>

        <section id="catalog" className="scroll-mt-24 border-y border-white/10 bg-[#10213a]/65 py-20 md:py-24">
          <div className="container">
            <motion.div {...reveal} className="mb-10">
              <p className="store-kicker">{t("store.catalog.kicker")}</p>
              <h2 className="store-section-title mt-3">{t("store.catalog.title")}</h2>
            </motion.div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {storeCategories.map((category, index) => {
                const categoryProducts = storeProducts.filter((product) => product.category === category);
                const previewProduct = categoryProducts[0];
                return previewProduct ? (
                  <SpotlightCard
                    {...reveal}
                    key={category}
                    transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : index * 0.06 }}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(buildLocalizedPath(resolveLanguage(lng), `/store/category/${category}`))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(buildLocalizedPath(resolveLanguage(lng), `/store/category/${category}`));
                      }
                    }}
                    className="store-card cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-6 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <div className="flex items-center justify-between gap-3">

                      <span className="text-xs text-white/50">{t("store.catalog.modelCount", { count: categoryProducts.length })}</span>
                    </div>
                    <div className="relative flex aspect-[4/3] items-center justify-center py-7">
                      <ProductImage product={previewProduct} className="max-h-44 w-full" />
                    </div>
                    <div className="border-t border-white/10 pt-5">
                      <h3 className="text-2xl font-semibold tracking-tight">{t(`store.categories.${category}`)}</h3>
                      <p className="mt-3 min-h-12 text-sm leading-6 text-white/55">{t(`store.categoryDescriptions.${category}`)}</p>
                    </div>
                    <p className="mt-4 text-xs text-white/45">{t("store.catalog.openCategory")}</p>
                  </SpotlightCard>
                ) : null;
              })}
            </div>
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
              <ContactForm generalContact showDetails={false} />
            </Suspense>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

    </div>
  );
}
