import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Carousel, Card } from "../../components/ui/apple-cards-carousel";
import { ScrollReveal } from "../../components/ui/scroll-reveal";
import Gallery from "../../components/Gallery";
import ProductOverviewSection from "../../components/product/OverviewSection";
import { dispatchOpenContactModal } from "../../lib/contact-modal";
import { useInViewOnce } from "../../hooks/use-in-view-once";
import { resolveLanguage } from "../i18n";

interface Product {
  id: number;
  slug: string;
  name: string;
  description?: string;
  category: string | null;
  available: boolean;
  order?: number;
  icon?: ProductImagePreview | null;
  first_image?: ProductImagePreview | null;
  drone_slider?: ProductDroneSliderMedia | null;
}

interface ProductImagePreview {
  url: string | null;
  alt?: string | null;
}

interface ProductDroneSliderMedia {
  image?: string | null;
  video?: string | null;
}

interface ProductImage {
  id: number;
  url: string | null;
  alt?: string | null;
  order?: number | null;
}

type OverviewIconApi =
  | {
      type: "lucide";
      name?: string | null;
    }
  | {
      type: "upload";
      url?: string | null;
    }
  | null;

interface ProductFeature {
  id: number;
  name: string;
  value: string;
  description?: string;
  icon?: OverviewIconApi;
  order?: number | null;
}

interface ProductGallery {
  id: number;
  url: string | null;
  alt?: string | null;
  order?: number | null;
}

interface ProductSubFeature {
  id: number;
  name: string;
  description?: string;
  icon?: OverviewIconApi;
  order?: number | null;
}

interface ProductTechnology {
  id: number;
  name: string;
  description?: string;
  tags?: Array<string>;
  order?: number | null;
}

interface ProductFeatureBlock {
  id: number;
  name: string;
  title: string;
  description?: string;
  background_image: string | null;
  with_logo: boolean;
  order?: number | null;
}

interface ProductInfoBlock {
  id: number;
  title_1: string;
  description_1?: Array<string> | null;
  image_1: string;
  title_2: string;
  description_2?: Array<string> | null;
  image_2: string;
  order?: number | null;
}

interface ProductCTABlock {
  id: number;
  name: string;
  title: string;
  background_image: string | null;
  has_button: boolean;
  order?: number | null;
}

interface ProductFinalCTABlock {
  id: number;
  title: string;
  paragraph?: string | null;
  has_button: boolean;
}

interface ProductDetail extends Product {
  specs?: string | null;
  created_at?: string;
  updated_at?: string;
  images?: ProductImage[];
  features?: ProductFeature[];
  sub_features?: ProductSubFeature[];
  gallery?: ProductGallery[];
  technologies?: ProductTechnology[];
  feature_blocks?: ProductFeatureBlock[];
  info_blocks?: ProductInfoBlock[];
  cta_blocks?: ProductCTABlock[];
  final_cta_block?: ProductFinalCTABlock | null;
}

const PRODUCT_HERO_WIDTH = 1600;
const PRODUCT_HERO_HEIGHT = 900;
const PRODUCT_HERO_IMAGE_PROPS = {
  width: PRODUCT_HERO_WIDTH,
  height: PRODUCT_HERO_HEIGHT,
  sizes: "100vw",
  style: { aspectRatio: `${PRODUCT_HERO_WIDTH} / ${PRODUCT_HERO_HEIGHT}` },
} as const;

function ProductHeroFallback() {
  return (
    <>
      <div className="absolute inset-0 animate-pulse bg-white/10" />
      <div className="absolute top-1/2 left-1/2 z-20 flex w-full max-w-[70%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 max-md:max-w-[90%]">
        <div className="h-4 w-28 animate-pulse rounded-full bg-white/15 max-lg:hidden" />
        <div className="h-12 w-full max-w-xl animate-pulse rounded-full bg-white/18 max-md:h-10" />
      </div>
    </>
  );
}

function ProductOverviewFallback() {
  return (
    <section
      aria-hidden="true"
      className="relative my-16 overflow-hidden rounded-4xl border border-white/10 bg-[linear-gradient(180deg,#1c2c46_0%,#14233a_100%)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-6 lg:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[40px_40px] opacity-30" />
      <div className="relative space-y-5 lg:space-y-6">
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,#151f31_0%,#111a2a_100%)] px-6 py-7 md:px-8 md:py-9">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.82fr)]">
            <div className="order-2 space-y-4 lg:order-1 lg:max-w-3xl">
              <div className="h-10 w-full max-w-xl animate-pulse rounded-full bg-white/16 max-md:h-8" />
              <div className="h-4 w-full max-w-3xl animate-pulse rounded-full bg-white/10" />
              <div className="h-4 w-5/6 animate-pulse rounded-full bg-white/10" />
              <div className="h-14 w-48 animate-pulse rounded-2xl bg-[#9be3ff]/30 max-md:w-full" />
            </div>
            <div className="order-1 grid gap-3 sm:grid-cols-2 lg:order-2 lg:self-start">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,#18263d_0%,#152136_100%)] p-3.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 animate-pulse rounded-xl bg-white/12" />
                    <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/10" />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="h-7 w-3/4 animate-pulse rounded-full bg-white/14" />
                    <div className="h-3.5 w-full animate-pulse rounded-full bg-white/10" />
                    <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,#1b2a44_0%,#18253d_100%)] p-5"
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 animate-pulse rounded-2xl bg-white/12" />
                <div className="mt-1 h-8 flex-1 animate-pulse rounded-full bg-white/14" />
              </div>
              <div className="mt-3 space-y-3">
                <div className="h-4 w-full animate-pulse rounded-full bg-white/10" />
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductDeferredFallback() {
  return (
    <div aria-hidden="true" className="space-y-10 py-12 max-sm:py-8">
      <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/6 max-md:h-56" />
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <div className="h-8 w-56 animate-pulse rounded-full bg-white/14" />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-3xl border border-white/10 bg-white/6"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RelatedProductsFallback() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded-full bg-white/14 max-md:h-8" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-sm"
          >
            <div className="aspect-5/7 animate-pulse bg-white/10" />
            <div className="space-y-3 p-5">
              <div className="h-6 w-3/4 animate-pulse rounded-full bg-white/12" />
              <div className="h-4 w-full animate-pulse rounded-full bg-white/8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type ProductPreviewData = ProductDetail;
export default function ProductDetail({ previewData }: { previewData?: ProductDetail } = {}) {
  const { slug, lng } = useParams<{ slug?: string; lng?: string }>();
  const activeLanguage = resolveLanguage(lng);
  const { t } = useTranslation();
  const [items, setItems] = useState<Product[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(
    null,
  );
  const [detailStatus, setDetailStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [hasActivatedCarousel, setHasActivatedCarousel] = useState(false);
  const { ref: deferredSectionsRef, inView: shouldRenderDeferredSections } =
    useInViewOnce({ rootMargin: "0px" });
  const { ref: relatedProductsRef, inView: shouldLoadRelatedProducts } =
    useInViewOnce({ rootMargin: "240px 0px 0px 0px" });
  const openContactModal = () => dispatchOpenContactModal();

  useEffect(() => {
    if (previewData || !shouldLoadRelatedProducts) {
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setErrorMessage(null);
    axios
      .get<Product[]>(`${import.meta.env.VITE_API_URL}/items/`, {
        signal: controller.signal,
        params: { lang: activeLanguage },
      })
      .then((res) => {
        setItems(res.data);
        setStatus("ready");
      })
      .catch((err) => {
        if (axios.isCancel(err)) {
          return;
        }
        console.error("Unable to load products", err);
        setErrorMessage(t("productDetail.errors.list"));
        setStatus("error");
      });

    return () => controller.abort();
  }, [activeLanguage, shouldLoadRelatedProducts, t, previewData]);

  useEffect(() => {
    if (previewData) {
      setProductDetail(previewData);
      setDetailStatus("ready");
      setDetailError(null);
      return;
    }
    if (!slug) {
      return;
    }

    const controller = new AbortController();
    setDetailStatus("loading");
    setDetailError(null);
    setProductDetail(null);

    axios
      .get<ProductDetail>(`${import.meta.env.VITE_API_URL}/items/${slug}/`, {
        signal: controller.signal,
        params: { lang: activeLanguage },
      })
      .then((res) => {
        setProductDetail(res.data);
        setDetailStatus("ready");
      })
      .catch((err) => {
        if (axios.isCancel(err)) {
          return;
        }
        console.error("Unable to load product detail", err);
        setDetailError(t("productDetail.errors.detail"));
        setDetailStatus("error");
      });

    return () => controller.abort();
  }, [activeLanguage, slug, t, previewData]);

  const heroProduct = productDetail;

  const productImages = useMemo(() => {
    const images = productDetail?.images ?? [];
    return [...images]
      .filter((img): img is ProductImage & { url: string } => Boolean(img.url))
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER),
      );
  }, [productDetail]);

  const productFeatures = useMemo(() => {
    const features = productDetail?.features ?? [];
    return [...features].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
    );
  }, [productDetail]);

  const productSubFeatures = useMemo(() => {
    const sub_features = productDetail?.sub_features ?? [];
    return [...sub_features].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
    );
  }, [productDetail]);

  const productGallery = useMemo(() => {
    const gallery = productDetail?.gallery ?? [];
    return [...gallery]
      .filter((item): item is ProductGallery & { url: string } =>
        Boolean(item.url),
      )
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
      );
  }, [productDetail]);

  const productTechnologies = useMemo(() => {
    const technologies = productDetail?.technologies ?? [];
    return [...technologies].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
    );
  }, [productDetail]);

  const productFeatureBlocks = useMemo(() => {
    const blocks = productDetail?.feature_blocks ?? [];
    return [...blocks].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
    );
  }, [productDetail]);

  const productInfoBlocks = useMemo(() => {
    const blocks = productDetail?.info_blocks ?? [];
    return [...blocks].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
    );
  }, [productDetail]);

  const productCTABlocks = useMemo(() => {
    const blocks = productDetail?.cta_blocks ?? [];
    return [...blocks].sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
    );
  }, [productDetail]);

  const productFinalCTABlock = useMemo(() => {
    const block = productDetail?.final_cta_block;
    if (!block) {
      return null;
    }
    if (!block.title?.trim() && !block.paragraph?.trim() && !block.has_button) {
      return null;
    }
    return block;
  }, [productDetail]);

  const carouselProducts = useMemo(() => {
    const currentSlug = productDetail?.slug ?? slug;
    return [...items]
      .filter(
        (product) => Boolean(product.slug) && product.slug !== currentSlug,
      )
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
      );
  }, [items, productDetail?.slug, slug]);

  const activeImage = productImages[activeSlide] ?? null;
  const shouldRenderOverview =
    detailStatus === "loading" ||
    Boolean(
      productDetail?.description?.trim() ||
        productFeatures.length ||
        productSubFeatures.length,
    );

  useEffect(() => {
    setActiveSlide(0);
    setHasActivatedCarousel(false);
  }, [productImages.length, productDetail?.slug]);

  const handlePrevSlide = () => {
    if (productImages.length < 2) return;
    setHasActivatedCarousel(true);
    setActiveSlide(
      (prev) => (prev - 1 + productImages.length) % productImages.length,
    );
  };

  const handleNextSlide = () => {
    if (productImages.length < 2) return;
    setHasActivatedCarousel(true);
    setActiveSlide((prev) => (prev + 1) % productImages.length);
  };

  return (
    <div className="relative min-h-screen max-md:pb-7">
      <div className="relative">
        <div className="relative aspect-8/9 w-full overflow-hidden bg-linear-to-br from-white/10 via-white/5 to-transparent lg:aspect-video">
          {detailStatus === "loading" ? (
            <ProductHeroFallback />
          ) : activeImage ? (
            <>
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <img
                  src={activeImage.url}
                  alt={
                    activeImage.alt ??
                    heroProduct?.name ??
                    t("productDetail.hero.imageAlt")
                  }
                  className={`h-full w-full object-cover ${
                    hasActivatedCarousel ? "animate-kenburns-slow" : ""
                  }`}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  {...PRODUCT_HERO_IMAGE_PROPS}
                />
                <div
                  className={`pointer-events-none absolute inset-0 bg-linear-to-b from-black/70 via-black/45 to-black/75 ${
                    hasActivatedCarousel ? "animate-slide-glow" : ""
                  }`}
                />
                <div
                  className={`pointer-events-none absolute inset-10 ${
                    hasActivatedCarousel ? "animate-slide-glow" : ""
                  }`}
                />
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div
                    className={`absolute top-0 -left-1/3 h-full w-1/3 skew-x-12 bg-linear-to-r from-white/0 via-white/30 to-white/0 ${
                      hasActivatedCarousel
                        ? "animate-sweep-shimmer opacity-70"
                        : "opacity-0"
                    }`}
                  />
                </div>
              </div>
              <div className="absolute top-1/2 left-1/2 z-20 flex max-w-[70%] -translate-x-1/2 -translate-y-1/2 flex-col text-center drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)] max-md:max-w-[90%]">
                {productDetail?.category ? (
                  <p className="text-foreground/70 hidden text-xl tracking-widest uppercase lg:inline">
                    {productDetail.category}
                  </p>
                ) : null}
                {productDetail?.name ? (
                  <h1 className="text-foreground/75 md:text-text text-2xl leading-8 font-bold text-pretty md:text-3xl md:leading-12 lg:text-4xl lg:leading-14 xl:text-5xl">
                    {productDetail.name}
                  </h1>
                ) : null}
              </div>
              {productImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={handlePrevSlide}
                    className="absolute top-1/2 left-20 z-20 inline-flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/60 text-white shadow-lg transition hover:border-white/50 hover:bg-black/80 max-xl:left-10 max-md:left-5 max-md:h-10 max-md:w-10"
                    aria-label={t("productDetail.hero.previousImage")}
                  >
                    <ChevronLeft className="h-5 w-5 max-md:h-4 max-md:w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextSlide}
                    className="absolute top-1/2 right-20 z-20 inline-flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/60 text-white shadow-lg transition hover:border-white/50 hover:bg-black/80 max-xl:right-10 max-md:right-5 max-md:h-10 max-md:w-10"
                    aria-label={t("productDetail.hero.nextImage")}
                  >
                    <ChevronRight className="h-5 w-5 max-md:h-4 max-md:w-4" />
                  </button>
                </>
              ) : null}
            </>
          ) : detailStatus === "error" ? (
            <img
              src="/hero-bg-1.jpg"
              className="absolute inset-0 h-full w-full object-cover"
              alt={heroProduct?.name ?? t("productDetail.hero.heroAlt")}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              {...PRODUCT_HERO_IMAGE_PROPS}
            />
          ) : (
            <ProductHeroFallback />
          )}
        </div>
        {productImages.length > 1 ? (
          <div className="absolute right-0 bottom-5 left-0">
            <div className="flex items-center justify-center gap-2">
              {productImages.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => {
                    setHasActivatedCarousel(true);
                    setActiveSlide(index);
                  }}
                  aria-label={t("productDetail.hero.goToImage", {
                    index: index + 1,
                  })}
                  className={`h-2.5 w-2.5 rounded-full border border-white/35 transition ${
                    activeSlide === index
                      ? "bg-white"
                      : "bg-white/30 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : null}
        {detailStatus === "error" && detailError ? (
          <p className="mt-3 px-5 text-lg font-medium text-red-300">
            {detailError}
          </p>
        ) : null}
      </div>
      <div className="container">
        {shouldRenderOverview ? (
          detailStatus === "loading" ? (
            <ProductOverviewFallback />
          ) : (
            <ProductOverviewSection
              title={t("productDetail.overview.title")}
              description={
                heroProduct?.description ??
                t("productDetail.overview.descriptionFallback")
              }
              features={productFeatures}
              subFeatures={productSubFeatures}
              contactLabel={t("productDetail.actions.contact")}
              onContactClick={openContactModal}
            />
          )
        ) : null}
        <div
          ref={deferredSectionsRef}
          className="h-px w-full"
          aria-hidden="true"
        />
        {shouldRenderDeferredSections || previewData ? (
          <>
            {productGallery.length > 0 ? (
              <Gallery
                images={productGallery.map((item) => ({
                  src: item.url,
                  alt: item.alt ?? productDetail?.name ?? heroProduct?.name,
                }))}
              />
            ) : null}

            {productTechnologies.length > 0 ? (
              <section className="space-y-8 py-16 max-sm:py-12">
                <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <ScrollReveal>
                    <div>
                      <p className="text-foreground/50 text-sm tracking-wider uppercase">
                        {t("productDetail.technology.kicker")}
                      </p>
                      <h2 className="text-3xl font-semibold">
                        {t("productDetail.technology.title")}
                      </h2>
                      <p className="text-foreground/75 mt-2 max-w-2xl">
                        {t("productDetail.technology.description")}
                      </p>
                    </div>
                  </ScrollReveal>
                </header>
                <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                  {productTechnologies.map((technology) => {
                    const tags = technology.tags ?? [];
                    return (
                      <ScrollReveal
                        key={technology.id}
                        delay={0.06 * technology.id}
                      >
                        <article className="bg-secondary/30 text-foreground h-full rounded-3xl border border-white/10 p-5 shadow-inner shadow-black/50">
                          <h3 className="text-2xl font-semibold">
                            {technology.name}
                          </h3>
                          {technology.description ? (
                            <p className="text-foreground/70 mt-3 text-sm">
                              {technology.description}
                            </p>
                          ) : null}
                          {tags.length > 0 ? (
                            <div className="mt-6 flex flex-wrap gap-2">
                              {tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-white/10 px-3 py-1 text-xs tracking-wide text-white/50 uppercase shadow-sm shadow-black/15 backdrop-blur-lg"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      </ScrollReveal>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {productFeatureBlocks.length > 0
              ? productFeatureBlocks.map((block) =>
                  !block.with_logo ? (
                    <section
                      key={block.id}
                      className={`relative right-1/2 left-1/2 -mr-[50vw] -ml-[50vw] flex w-screen items-end ${
                        block.background_image
                          ? "aspect-1440/960 h-[70vh] bg-cover bg-center max-lg:aspect-auto max-lg:min-h-[360px] max-md:min-h-[300px]"
                          : ""
                      }`}
                      style={
                        block.background_image
                          ? {
                              backgroundImage: `url(${block.background_image})`,
                            }
                          : undefined
                      }
                    >
                      <ScrollReveal className="container space-y-5 pb-12.5 max-md:space-y-4 max-md:text-center lg:pb-25">
                        <div>
                          <span className="border-border/10 rounded-[30px] border bg-white/20 px-4 py-2 uppercase backdrop-blur-xs">
                            {block.name}
                          </span>
                        </div>
                        <h1 className="text-5xl font-bold max-lg:text-4xl max-md:text-3xl">
                          {block.title}
                        </h1>
                        <p className="text-foreground/70 text-lg max-md:text-base">
                          {block.description}
                        </p>
                      </ScrollReveal>
                    </section>
                  ) : (
                    <section key={block.id} className="py-16 max-sm:py-12">
                      <ScrollReveal className="flex items-center justify-between max-md:flex-col max-md:space-y-10">
                        <div className="max-md:text-center">
                          <p className="tracking-wider uppercase">
                            {block.name}
                          </p>
                          <h1 className="text-5xl leading-tight font-bold max-lg:text-4xl max-md:text-3xl">
                            {block.title}
                          </h1>
                          <p className="text-foreground/70 mt-2 max-w-lg text-lg leading-relaxed max-md:text-base">
                            {block.description}
                          </p>
                        </div>
                        <div>
                          <img
                            src="/focus-areas-core.svg"
                            className="mx-10 w-60 max-md:w-50 max-sm:w-40"
                            alt=""
                          />
                        </div>
                      </ScrollReveal>
                    </section>
                  ),
                )
              : null}

            {productInfoBlocks.length > 0
              ? productInfoBlocks.map((block) => {
                  const description1 = block.description_1 ?? [];
                  const description2 = block.description_2 ?? [];
                  return (
                    <section
                      key={block.id}
                      className="relative right-1/2 left-1/2 -mr-[50vw] -ml-[50vw] flex w-screen items-end bg-white"
                    >
                      <div className="container m-auto grid grid-cols-1 gap-12 px-5 py-12 max-sm:py-10">
                        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                          <ScrollReveal className="flex flex-col items-start justify-center gap-4 text-left lg:max-w-[480px]">
                            <h1 className="text-5xl font-bold text-black max-lg:text-4xl max-md:text-3xl">
                              {block.title_1}
                            </h1>
                            <ul className="space-y-3 text-black">
                              {description1.map((tag) => (
                                <li
                                  key={tag}
                                  className="flex max-w-[420px] items-center gap-3"
                                >
                                  <span className="text-lg max-md:text-base">
                                    {tag}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </ScrollReveal>
                          <ScrollReveal className="w-full max-w-150 max-lg:max-w-100 lg:w-auto">
                            <img
                              src={block.image_1}
                              alt=""
                              className="w-full object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          </ScrollReveal>
                        </div>
                        <div className="flex flex-col-reverse gap-8 lg:flex-row lg:items-center lg:justify-between">
                          <ScrollReveal
                            delay={0.06}
                            className="w-full max-w-175 max-lg:max-w-125 lg:w-auto"
                          >
                            <img
                              src={block.image_2}
                              alt=""
                              className="w-full object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          </ScrollReveal>
                          <ScrollReveal
                            delay={0.12}
                            className="flex flex-col justify-center gap-4 text-left"
                          >
                            <h1 className="max-w-lg text-5xl font-bold text-balance text-black max-lg:text-4xl max-md:text-3xl">
                              {block.title_2}
                            </h1>
                            <ul className="space-y-3 text-black">
                              {description2.map((tag) => (
                                <li
                                  key={tag}
                                  className="flex max-w-[420px] items-center gap-3"
                                >
                                  <span className="text-lg max-md:text-base">
                                    {tag}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </ScrollReveal>
                        </div>
                      </div>
                    </section>
                  );
                })
              : null}

            {productCTABlocks.length > 0
              ? productCTABlocks.map((block) => (
                  <section
                    key={block.id}
                    className="relative right-1/2 left-1/2 -mr-[50vw] -ml-[50vw] flex aspect-1440/960 max-h-[90vh] w-screen items-end bg-cover bg-center max-lg:aspect-auto max-lg:min-h-[360px] max-md:min-h-[300px]"
                    style={{
                      backgroundImage: block.background_image
                        ? `url(${block.background_image})`
                        : undefined,
                    }}
                  >
                    <div className="container mx-auto px-6 pb-12.5 max-xl:px-5 max-sm:px-4 lg:pb-25">
                      <ScrollReveal className="space-y-5 max-md:space-y-4 max-md:text-center">
                        <div>
                          <span className="border-border/10 rounded-[30px] border bg-white/20 px-4 py-2 uppercase backdrop-blur-xs">
                            {block.name}
                          </span>
                        </div>
                        <h1 className="text-5xl font-bold max-lg:text-4xl max-sm:text-2xl">
                          {block.title}
                        </h1>
                        {block.has_button ? (
                          <ScrollReveal
                            delay={0.1}
                            className="mt-3 flex max-md:justify-center"
                          >
                            <a
                              onClick={openContactModal}
                              className="group relative inline-flex h-14 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-white px-8 text-lg font-bold text-black uppercase transition-all duration-300 ease-out will-change-transform hover:shadow-[inset_0_3px_12px_rgba(255,255,255,0.35),inset_0_-6px_20px_rgba(0,0,0,0.45)] active:scale-[0.93] active:shadow-[inset_0_1px_6px_rgba(255,255,255,0.5),inset_0_-8px_22px_rgba(0,0,0,0.65)] max-md:h-12 max-md:text-base"
                            >
                              {t("productDetail.actions.contact")}
                            </a>
                          </ScrollReveal>
                        ) : null}
                      </ScrollReveal>
                    </div>
                  </section>
                ))
              : null}

            <section
              ref={relatedProductsRef}
              className="space-y-6 py-10 max-sm:py-8"
            >
              {shouldLoadRelatedProducts && status === "ready" ? (
                <ScrollReveal delay={0.12}>
                  <Carousel
                    carouselTitle={t("productDetail.carousel.title")}
                    items={carouselProducts.map((product, index) => (
                      <Card
                        key={product.id}
                        card={{
                          category: product.category ?? "",
                          title: product.name,
                          description: product.description?.trim() ?? "",
                          href: `/products/${product.slug}`,
                          bg:
                            product.drone_slider?.image ??
                            product.first_image?.url ??
                            product.icon?.url ??
                            "/placeholder.svg",
                          video: product.drone_slider?.video ?? undefined,
                        }}
                        index={index}
                      />
                    ))}
                  />
                </ScrollReveal>
              ) : (
                <RelatedProductsFallback />
              )}
              {status === "error" ? (
                <div className="rounded-3xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-200">
                  {errorMessage ?? t("productDetail.errors.catalogFallback")}
                </div>
              ) : null}
            </section>

            {productFinalCTABlock ? (
              <section className="container mx-auto flex flex-col items-center justify-center space-y-25 px-5 py-25 max-lg:space-y-15 max-lg:py-12.5">
                <ScrollReveal
                  className="flex w-full max-w-4xl flex-col items-center gap-y-8 text-center max-md:gap-y-4"
                  from="down"
                  duration={0.5}
                  distance={0}
                >
                  {productFinalCTABlock.title ? (
                    <h1 className="text-center text-5xl font-bold max-lg:text-4xl">
                      {productFinalCTABlock.title}
                    </h1>
                  ) : null}
                  {productFinalCTABlock.paragraph ? (
                    <p className="max-w-3xl text-center text-lg max-md:text-base max-md:text-balance">
                      {productFinalCTABlock.paragraph}
                    </p>
                  ) : null}
                  {productFinalCTABlock.has_button ? (
                    <div>
                      <a
                        onClick={openContactModal}
                        className="group relative inline-flex h-14 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-white px-8 text-lg font-bold text-black uppercase transition-all duration-300 ease-out will-change-transform hover:shadow-[inset_0_3px_12px_rgba(255,255,255,0.35),inset_0_-6px_20px_rgba(0,0,0,0.45)] active:scale-[0.93] active:shadow-[inset_0_1px_6px_rgba(255,255,255,0.5),inset_0_-8px_22px_rgba(0,0,0,0.65)] max-md:h-12 max-md:text-base"
                      >
                        {t("productDetail.actions.contact")}
                      </a>
                    </div>
                  ) : null}
                </ScrollReveal>
              </section>
            ) : null}
          </>
        ) : (
          <ProductDeferredFallback />
        )}
      </div>
    </div>
  );
}
