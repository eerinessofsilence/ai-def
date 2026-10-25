"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { usePageTranslation } from "../PageContent";
import { useParams } from "react-router-dom";
import { Carousel, Card } from "../ui/apple-cards-carousel";
import { ScrollReveal } from "../ui/scroll-reveal";
import { resolveLanguage } from "../../src/i18n";

export default function DroneCarouselSection() {
  const { lng } = useParams<{ lng?: string }>();
  const activeLanguage = resolveLanguage(lng);
  const { t } = usePageTranslation();
  const [items, setItems] = useState<CarouselProductItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setErrorMessage(null);
    const requestConfig = {
      signal: controller.signal,
      params: { lang: activeLanguage },
    };

    Promise.all([
      axios.get<ProductListApiItem[]>(
        `${import.meta.env.VITE_API_URL}/items/`,
        requestConfig,
      ),
      axios.get<ProductListApiItem[]>(
        `${import.meta.env.VITE_API_URL}/civil-items/`,
        requestConfig,
      ),
    ])
      .then(([productResponse, civilProductResponse]) => {
        setItems([
          ...productResponse.data.map((product) => ({
            ...product,
            productType: "product" as const,
            href: `/products/${product.slug}`,
            sourceOrder: 0,
          })),
          ...civilProductResponse.data.map((product) => ({
            ...product,
            productType: "civilProduct" as const,
            href: `/civil-products/${product.slug}`,
            sourceOrder: 1,
          })),
        ]);
        setStatus("ready");
      })
      .catch((error) => {
        if (axios.isCancel(error)) {
          return;
        }
        console.error("Unable to load DroneSlider products", error);
        setErrorMessage(t("productDetail.errors.list"));
        setStatus("error");
      });

    return () => controller.abort();
  }, [activeLanguage, t]);

  const cards = useMemo(
    () =>
      [...items]
        .filter((product) => Boolean(product.slug))
        .sort(
          (a, b) =>
            a.sourceOrder - b.sourceOrder ||
            (a.order ?? Number.MAX_SAFE_INTEGER) -
              (b.order ?? Number.MAX_SAFE_INTEGER) ||
            a.id - b.id,
        )
        .map((product, index) => (
          <Card
            key={`${product.productType}-${product.id}`}
            card={{
              category: product.category ?? "",
              title: product.name,
              description: product.description?.trim() ?? "",
              href: product.href,
              bg:
                product.drone_slider?.image ??
                product.first_image?.url ??
                product.icon?.url ??
                "/placeholder.svg",
              video: product.drone_slider?.video ?? undefined,
            }}
            index={index}
          />
        )),
    [items],
  );

  return (
    <div className="h-full w-full py-16 max-lg:py-12">
      <ScrollReveal delay={0.12}>
        <Carousel
          paragraph={t("main.droneCarousel.description")}
          carouselTitle={t("main.droneCarousel.title")}
          items={cards}
          variant="fullBleed"
        />
      </ScrollReveal>
      {status === "error" ? (
        <div className="container mx-auto px-5">
          <div className="mt-2 rounded-3xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-200">
            {errorMessage ?? t("productDetail.errors.catalogFallback")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ProductImagePreview = {
  url: string | null;
  alt?: string | null;
};

type ProductDroneSliderMedia = {
  image?: string | null;
  video?: string | null;
};

type ProductListApiItem = {
  id: number;
  slug: string;
  name: string;
  description?: string;
  category: string | null;
  order?: number | null;
  icon?: ProductImagePreview | null;
  first_image?: ProductImagePreview | null;
  drone_slider?: ProductDroneSliderMedia | null;
};

type CarouselProductItem = ProductListApiItem & {
  productType: "product" | "civilProduct";
  href: string;
  sourceOrder: number;
};
