import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import ProductOverviewSection from "../../components/product/OverviewSection";
import { ScrollReveal } from "../../components/ui/scroll-reveal";
import Gallery from "../../components/Gallery";
import { dispatchOpenContactModal } from "../../lib/contact-modal";
import { resolveLanguage } from "../i18n";

interface Product {
  id: number;
  slug: string;
  name: string;
  description?: string;
  category: string | null;
  available: boolean;
  order?: number;
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
  background_image: string;
  has_button: boolean;
  order?: number | null;
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
}

type ProductInfoSection = {
  title: string;
  description: string[];
  image: string | null;
};

type ProductInfoBlockPrepared = ProductInfoBlock & {
  section_1: ProductInfoSection | null;
  section_2: ProductInfoSection | null;
};

const hasText = (value?: string | null): value is string =>
  typeof value === "string" && value.trim().length > 0;

const hasAnyText = (...values: Array<string | null | undefined>): boolean =>
  values.some((value) => hasText(value));

const normalizeTextArray = (value?: Array<string> | null): string[] =>
  (value ?? []).map((item) => item.trim()).filter((item) => item.length > 0);

export type CivilProductPreviewData = ProductDetail;
export default function CivilProductDetail({ previewData }: { previewData?: ProductDetail } = {}) {
  const { slug, lng } = useParams<{ slug?: string; lng?: string }>();
  const activeLanguage = resolveLanguage(lng);
  const { t } = useTranslation();
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(
    null,
  );
  const [detailStatus, setDetailStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const openContactModal = () => dispatchOpenContactModal();

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
      .get<ProductDetail>(
        `${import.meta.env.VITE_API_URL}/civil-items/${slug}/`,
        {
          signal: controller.signal,
          params: { lang: activeLanguage },
        },
      )
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

  const heroProduct = useMemo(() => productDetail ?? null, [productDetail]);

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
    return [...features]
      .filter((feature) =>
        hasAnyText(feature.name, feature.value, feature.description),
      )
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
      );
  }, [productDetail]);

  const productSubFeatures = useMemo(() => {
    const sub_features = productDetail?.sub_features ?? [];
    return [...sub_features]
      .filter((subFeature) =>
        hasAnyText(subFeature.name, subFeature.description),
      )
      .sort(
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
    return [...technologies]
      .map((technology) => ({
        ...technology,
        name: technology.name.trim(),
        description: technology.description?.trim() || undefined,
        tags: normalizeTextArray(technology.tags),
      }))
      .filter(
        (technology) =>
          hasAnyText(technology.name, technology.description) ||
          technology.tags.length > 0,
      )
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
      );
  }, [productDetail]);

  const productFeatureBlocks = useMemo(() => {
    const blocks = productDetail?.feature_blocks ?? [];
    return [...blocks]
      .filter((block) => hasAnyText(block.name, block.title, block.description))
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
      );
  }, [productDetail]);

  const productInfoBlocks = useMemo<ProductInfoBlockPrepared[]>(() => {
    const blocks = productDetail?.info_blocks ?? [];
    return [...blocks]
      .map<ProductInfoBlockPrepared | null>((block) => {
        const description1 = normalizeTextArray(block.description_1);
        const description2 = normalizeTextArray(block.description_2);

        const section1 =
          hasAnyText(block.title_1, block.image_1) || description1.length > 0
            ? {
                title: block.title_1.trim(),
                description: description1,
                image: hasText(block.image_1) ? block.image_1 : null,
              }
            : null;

        const section2 =
          hasAnyText(block.title_2, block.image_2) || description2.length > 0
            ? {
                title: block.title_2.trim(),
                description: description2,
                image: hasText(block.image_2) ? block.image_2 : null,
              }
            : null;

        if (!section1 && !section2) {
          return null;
        }

        return {
          ...block,
          section_1: section1,
          section_2: section2,
        };
      })
      .filter((block): block is ProductInfoBlockPrepared => block !== null)
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
      );
  }, [productDetail]);

  const productCTABlocks = useMemo(() => {
    const blocks = productDetail?.cta_blocks ?? [];
    return [...blocks]
      .filter(
        (block) =>
          hasAnyText(block.name, block.title, block.background_image) ||
          block.has_button,
      )
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
      );
  }, [productDetail]);

  const overviewDescription = heroProduct?.description?.trim();
  const hasOverviewSection =
    Boolean(overviewDescription) ||
    productFeatures.length > 0 ||
    productSubFeatures.length > 0;

  useEffect(() => {
    setActiveSlide(0);
  }, [productImages.length, productDetail?.slug]);

  const handlePrevSlide = () => {
    if (productImages.length < 2) return;
    setActiveSlide(
      (prev) => (prev - 1 + productImages.length) % productImages.length,
    );
  };

  const handleNextSlide = () => {
    if (productImages.length < 2) return;
    setActiveSlide((prev) => (prev + 1) % productImages.length);
  };

  return (
    <div className="relative min-h-screen max-md:pb-7">
      <ScrollReveal className="w-full">
        <div>
          <div className="relative aspect-8/9 w-full overflow-hidden bg-linear-to-br from-white/10 via-white/5 to-transparent lg:aspect-video">
            {detailStatus === "loading" ? (
              <div className="absolute inset-0 animate-pulse bg-white/10" />
            ) : productImages.length > 0 ? (
              <>
                {productImages.map((image, index) => (
                  <div
                    key={image.id}
                    className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-600 ${
                      activeSlide === index ? "z-10 opacity-100" : "opacity-0"
                    }`}
                  >
                    <img
                      src={image.url ?? ""}
                      alt={
                        image.alt ??
                        heroProduct?.name ??
                        t("productDetail.hero.imageAlt")
                      }
                      className={`h-full w-full object-cover ${
                        activeSlide === index ? "animate-kenburns-slow" : ""
                      }`}
                    />
                    <div
                      className={`pointer-events-none absolute inset-0 bg-linear-to-b from-black/70 via-black/45 to-black/75 ${
                        activeSlide === index ? "animate-slide-glow" : ""
                      }`}
                    />
                    <div
                      className={`pointer-events-none absolute inset-10 ${
                        activeSlide === index ? "animate-slide-glow" : ""
                      }`}
                    />
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div
                        className={`absolute top-0 -left-1/3 h-full w-1/3 skew-x-12 bg-linear-to-r from-white/0 via-white/30 to-white/0 ${
                          activeSlide === index
                            ? "animate-sweep-shimmer opacity-70"
                            : "opacity-0"
                        }`}
                      />
                    </div>
                  </div>
                ))}
                <div className="absolute top-1/2 left-1/2 z-20 flex max-w-[70%] -translate-x-1/2 -translate-y-1/2 flex-col text-center drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)] max-md:max-w-[90%]">
                  <p className="text-foreground/70 hidden text-xl tracking-widest uppercase lg:inline">
                    {productDetail?.category}
                  </p>
                  <h1 className="max-md:text-foreground/50 text-5xl leading-18 font-bold max-lg:text-4xl max-lg:leading-14 max-md:text-3xl max-md:leading-10 max-sm:text-2xl">
                    {productDetail?.name}
                  </h1>
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
            ) : (
              <img
                src="/hero-bg-1.png"
                className="absolute inset-0 h-full w-full object-cover"
                alt={heroProduct?.name ?? t("productDetail.hero.heroAlt")}
              />
            )}
          </div>
          {productImages.length > 1 ? (
            <div className="mt-5 flex items-center justify-center gap-2">
              {productImages.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setActiveSlide(index)}
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
          ) : null}
          {detailStatus === "error" && detailError ? (
            <p className="mt-3 px-5 text-lg font-medium text-red-300">
              {detailError}
            </p>
          ) : null}
        </div>
      </ScrollReveal>
      <div className="container space-y-8 py-16">
        {productDetail && hasOverviewSection ? (
          <ProductOverviewSection
            title={t("productDetail.overview.title")}
            description={
              overviewDescription ??
              t("productDetail.overview.descriptionFallback")
            }
            features={productFeatures}
            subFeatures={productSubFeatures}
            contactLabel={t("productDetail.actions.contact")}
            onContactClick={openContactModal}
          />
        ) : null}

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
                  <p className="text-foreground/70 mt-2 max-w-2xl">
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
                      {hasText(technology.name) ? (
                        <h3 className="text-2xl font-semibold">
                          {technology.name}
                        </h3>
                      ) : null}
                      {hasText(technology.description) ? (
                        <p className="text-foreground/70 mt-3 text-sm">
                          {technology.description}
                        </p>
                      ) : null}
                      {tags.length > 0 ? (
                        <div className="mt-6 flex flex-wrap gap-2">
                          {tags.map((tag, tagIndex) => (
                            <span
                              key={`${technology.id}-${tag}-${tagIndex}`}
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
          ? productFeatureBlocks.map((block) => {
              if (!block.with_logo) {
                return (
                  <section
                    key={block.id}
                    className={`relative right-1/2 left-1/2 -mr-[50vw] -ml-[50vw] flex w-screen items-end ${
                      block.background_image
                        ? "aspect-1440/960 h-[70vh] bg-cover bg-center max-lg:aspect-auto max-lg:min-h-[360px] max-md:min-h-[300px]"
                        : ""
                    }`}
                    style={
                      block.background_image
                        ? { backgroundImage: `url(${block.background_image})` }
                        : undefined
                    }
                  >
                    <ScrollReveal className="container space-y-5 pb-12.5 max-md:space-y-4 max-md:text-center lg:pb-25">
                      {hasText(block.name) ? (
                        <div>
                          <span className="border-border/10 rounded-[30px] border bg-white/20 px-4 py-2 uppercase backdrop-blur-xs">
                            {block.name}
                          </span>
                        </div>
                      ) : null}
                      {hasText(block.title) ? (
                        <h1 className="text-5xl font-bold max-lg:text-4xl max-md:text-3xl">
                          {block.title}
                        </h1>
                      ) : null}
                      {hasText(block.description) ? (
                        <p className="text-foreground/70 text-lg max-md:text-base">
                          {block.description}
                        </p>
                      ) : null}
                    </ScrollReveal>
                  </section>
                );
              }

              return (
                <section key={block.id} className="py-16 max-sm:py-12">
                  <ScrollReveal className="flex items-center justify-between max-md:flex-col max-md:space-y-10">
                    <div className="max-md:text-center">
                      {hasText(block.name) ? (
                        <p className="tracking-wider uppercase">{block.name}</p>
                      ) : null}
                      {hasText(block.title) ? (
                        <h1 className="text-5xl leading-tight font-bold max-lg:text-4xl max-md:text-3xl">
                          {block.title}
                        </h1>
                      ) : null}
                      {hasText(block.description) ? (
                        <p className="text-foreground/70 mt-2 max-w-lg text-lg leading-relaxed max-md:text-base">
                          {block.description}
                        </p>
                      ) : null}
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
              );
            })
          : null}
        {productInfoBlocks.length > 0
          ? productInfoBlocks.map((block) => {
              return (
                <section
                  key={block.id}
                  className="relative right-1/2 left-1/2 -mr-[50vw] -ml-[50vw] flex w-screen items-end bg-white"
                >
                  <div className="container m-auto grid grid-cols-1 gap-12 px-5 py-12 max-sm:py-10">
                    {block.section_1 ? (
                      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                        <ScrollReveal className="flex flex-col items-start justify-center gap-4 text-left lg:max-w-[480px]">
                          {hasText(block.section_1.title) ? (
                            <h1 className="text-5xl font-bold text-black max-lg:text-4xl max-md:text-3xl">
                              {block.section_1.title}
                            </h1>
                          ) : null}
                          {block.section_1.description.length > 0 ? (
                            <ul className="space-y-3 text-black">
                              {block.section_1.description.map((tag, index) => (
                                <li
                                  key={`${block.id}-section1-${index}`}
                                  className="flex max-w-[420px] items-center gap-3"
                                >
                                  <span className="text-lg max-md:text-base">
                                    {tag}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </ScrollReveal>
                        {block.section_1.image ? (
                          <ScrollReveal className="w-full max-w-150 max-lg:max-w-100 lg:w-auto">
                            <img
                              src={block.section_1.image}
                              alt={block.section_1.title || ""}
                              className="w-full object-contain"
                            />
                          </ScrollReveal>
                        ) : null}
                      </div>
                    ) : null}
                    {block.section_2 ? (
                      <div className="flex flex-col-reverse gap-8 lg:flex-row lg:items-center lg:justify-between">
                        {block.section_2.image ? (
                          <ScrollReveal
                            delay={0.06}
                            className="w-full max-w-175 max-lg:max-w-125 lg:w-auto"
                          >
                            <img
                              src={block.section_2.image}
                              alt={block.section_2.title || ""}
                              className="w-full object-contain"
                            />
                          </ScrollReveal>
                        ) : null}
                        <ScrollReveal
                          delay={0.12}
                          className="flex flex-col justify-center gap-4 text-left"
                        >
                          {hasText(block.section_2.title) ? (
                            <h1 className="max-w-lg text-5xl font-bold text-balance text-black max-lg:text-4xl max-md:text-3xl">
                              {block.section_2.title}
                            </h1>
                          ) : null}
                          {block.section_2.description.length > 0 ? (
                            <ul className="space-y-3 text-black">
                              {block.section_2.description.map((tag, index) => (
                                <li
                                  key={`${block.id}-section2-${index}`}
                                  className="flex max-w-[420px] items-center gap-3"
                                >
                                  <span className="text-lg max-md:text-base">
                                    {tag}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </ScrollReveal>
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })
          : null}
        {productCTABlocks.length > 0
          ? productCTABlocks.map((block) => (
              <section
                key={block.id}
                className="relative right-1/2 left-1/2 -mr-[50vw] -ml-[50vw] flex aspect-1440/960 w-screen items-end bg-cover bg-center max-lg:aspect-auto max-lg:min-h-[360px] max-md:min-h-[300px]"
                style={{
                  backgroundImage: `url(${block.background_image || "/pdetail-bg-img-2.png"})`,
                }}
              >
                <div className="container mx-auto px-6 pb-12.5 max-xl:px-5 max-sm:px-4 lg:pb-25">
                  <ScrollReveal className="space-y-5 max-md:space-y-4 max-md:text-center">
                    {hasText(block.name) ? (
                      <div>
                        <span className="border-border/10 rounded-[30px] border bg-white/20 px-4 py-2 uppercase backdrop-blur-xs">
                          {block.name}
                        </span>
                      </div>
                    ) : null}
                    {hasText(block.title) ? (
                      <h1 className="text-5xl font-bold max-lg:text-4xl max-sm:text-2xl">
                        {block.title}
                      </h1>
                    ) : null}
                    {block.has_button ? (
                      <ScrollReveal
                        delay={0.1}
                        className="mt-12 flex max-md:justify-center"
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
      </div>
    </div>
  );
}
