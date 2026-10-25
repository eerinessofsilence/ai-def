import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  FileText,
  Gauge,
  Lock,
  Package2,
  Radar,
  Radio,
  Settings,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { ScrollReveal } from "../../components/ui/scroll-reveal";
import { dispatchOpenContactModal } from "../../lib/contact-modal";
import { buildLocalizedPath, resolveLanguage } from "../i18n";

type StoredUser = {
  email?: string;
  first_name?: string;
  last_name?: string;
};

type ProductOption = {
  value: string;
  label: string;
};

type ProductDropdownProps = {
  id: string;
  label: string;
  value: string | null;
  options: Array<ProductOption>;
  disabled?: boolean;
  variant: "desktop" | "mobile";
  onChange: (value: string) => void;
};

type Product = {
  slug?: string;
  name: string;
  category: string;
  serial: string;
  preview_image: string;
  images: Array<string>;
  summary: string;
  highlight: string;
};

type PortalProductApi = {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  category_slug?: string | null;
  serial: string | null;
  preview_image: string | null;
  images: Array<string> | null;
  summary: string | null;
  highlight?: string | null;
};

type PortalCharacteristicItemApi = {
  id: number;
  name?: string | null;
  label?: string | null;
  description?: string | null;
  value?: string | null;
  order?: number | null;
  block_id?: number | null;
};

type PortalModuleCharacteristicApi = {
  id: number;
  name?: string | null;
  label?: string | null;
  description?: string | null;
  value?: string | null;
  order?: number | null;
};

type PortalTextBlockApi = {
  id: number;
  title?: string | null;
  text?: string | null;
  order?: number | null;
};

type PortalProductGalleryApi = {
  id: number;
  url?: string | null;
  alt?: string | null;
  order?: number | null;
};

type PortalPresentationInfoApi = {
  id: number;
  title?: string | null;
  description?: string | null;
  order?: number | null;
};

type PortalIconApi =
  | {
      type: "lucide";
      name?: string | null;
    }
  | {
      type: "upload";
      url?: string | null;
    }
  | null;

type PortalCharacteristicsBlockApi = {
  id: number;
  subtitle?: string | null;
  title?: string | null;
  icon?: PortalIconApi;
  items?: Array<PortalCharacteristicItemApi>;
};

type PortalCharacteristicsApi = {
  blocks?: Array<PortalCharacteristicsBlockApi>;
  items?: Array<PortalCharacteristicItemApi>;
};

type PortalModuleImageApi = {
  id: number;
  url: string;
  alt?: string | null;
};

type PortalModuleApi = {
  id: number;
  name?: string | null;
  title?: string | null;
  tag?: string | null;
  description?: string | null;
  action?: string | null;
  button_text?: string | null;
  order?: number | null;
  block_id?: number | null;
  image?: string | null;
  images?: Array<string> | null;
  module_images?: Array<PortalModuleImageApi>;
  module_characteristics?: Array<PortalModuleCharacteristicApi>;
};

type PortalModulesBlockApi = {
  id: number;
  subtitle?: string | null;
  title?: string | null;
  items?: Array<PortalModuleApi>;
};

type PortalModulesApi = {
  blocks?: Array<PortalModulesBlockApi>;
  items?: Array<PortalModuleApi>;
};

type PortalProductDetailApi = PortalProductApi & {
  description?: string | null;
  tags?: Array<string> | null;
  created_at?: string;
  updated_at?: string;
  gallery?: Array<PortalProductGalleryApi>;
  presentation_info?: Array<PortalPresentationInfoApi>;
  characteristics?: PortalCharacteristicsApi;
  modules?: PortalModulesApi;
  text_blocks?: Array<PortalTextBlockApi>;
};

type UpgradeModule = {
  id: number;
  title: string;
  description: string;
  image: string;
  action: string;
  tag?: string;
  images: Array<string>;
  moduleImages: Array<PortalModuleImageApi>;
  moduleCharacteristics: Array<{ id: number; label: string; value: string }>;
  blockTitle?: string;
  blockSubtitle?: string;
};

const SPEC_ICON_POOL = [ShieldCheck, Gauge, Cpu, Radar, Settings, Radio];
const isLucideComponent = (value: unknown): value is LucideIcon =>
  typeof value === "object" &&
  value !== null &&
  "$$typeof" in (value as Record<string, unknown>);
const LUCIDE_ICON_MAP: Record<string, LucideIcon> = Object.keys(
  LucideIcons,
).reduce(
  (acc, key) => {
    if (key === "icons" || key === "createLucideIcon") {
      return acc;
    }
    const candidate = (LucideIcons as Record<string, unknown>)[key];
    if (isLucideComponent(candidate)) {
      acc[key] = candidate;
    }
    return acc;
  },
  {} as Record<string, LucideIcon>,
);
const normalizeLucideName = (raw: string) => {
  const cleaned = raw.trim().replace(/^lucide[:\s_-]+/i, "");
  if (!cleaned) return "";
  const spaced = cleaned
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ");
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join("");
};
const resolveLucideIcon = (raw?: string | null) => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = normalizeLucideName(trimmed);
  const candidates = new Set<string>();
  candidates.add(trimmed);
  if (normalized) {
    candidates.add(normalized);
  }
  if (!trimmed.endsWith("Icon")) {
    candidates.add(`${trimmed}Icon`);
  }
  if (normalized && !normalized.endsWith("Icon")) {
    candidates.add(`${normalized}Icon`);
  }
  for (const candidate of candidates) {
    const icon = LUCIDE_ICON_MAP[candidate];
    if (icon) return icon;
  }
  return null;
};
const getProductKey = (product: Product) => product.slug || product.name;

function ProductDropdown({
  id,
  label,
  value,
  options,
  disabled = false,
  variant,
  onChange,
}: ProductDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const isDisabled = disabled || options.length === 0;
  const selectedLabel =
    options.find((option) => option.value === value)?.label ??
    options[0]?.label ??
    t("clientPortal.fallbacks.noProducts");

  useEffect(() => {
    if (!open) return;
    const handleClickAway = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [open]);

  useEffect(() => {
    if (isDisabled) {
      setOpen(false);
    }
  }, [isDisabled]);

  const wrapperClassName =
    variant === "mobile"
      ? "flex w-full flex-col gap-1 text-sm text-white/70"
      : "flex flex-col w-70 gap-1 text-sm text-white/70";
  const labelClassName =
    variant === "mobile"
      ? "text-center font-semibold tracking-widest text-white/70 uppercase"
      : "max-md:text-center text-right font-semibold tracking-widest text-white/70 uppercase";
  const containerClassName =
    variant === "mobile" ? "relative w-full" : "relative inline-flex w-full";
  const buttonClassName =
    variant === "mobile"
      ? "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-left font-semibold text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md transition hover:border-white/25 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:cursor-not-allowed disabled:opacity-50 disabled:brightness-75 sm:text-base"
      : "cursor-pointer w-full flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-left font-semibold text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-md transition hover:border-white/25 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 disabled:cursor-not-allowed disabled:opacity-50 disabled:brightness-75 sm:text-base";
  const listClassName =
    "absolute left-0 right-0 top-full z-30 mt-2 space-y-2 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-white/10 p-2 text-sm text-white/80 shadow-[0_20px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl";
  const optionBaseClass =
    "cursor-pointer flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none";

  return (
    <div className={wrapperClassName} ref={dropdownRef}>
      <span className={labelClassName}>{label}</span>
      <div className={containerClassName}>
        <button
          type="button"
          className={buttonClassName}
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
            }
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={id}
          disabled={isDisabled}
        >
          <span className="flex-1 truncate tracking-widest">
            {selectedLabel}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-white/70 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
        {open ? (
          <div id={id} role="listbox" className={listClassName}>
            {options.length ? (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`${optionBaseClass} ${
                    option.value === value
                      ? "bg-white/15 text-white"
                      : "text-white/80"
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setOpen(false);
                    }
                  }}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-white/60">
                {t("clientPortal.fallbacks.noProducts")}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type PortalPreviewData = PortalProductDetailApi;
export default function ClientPortal({ previewData }: { previewData?: PortalProductDetailApi } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lng } = useParams();
  const currentLanguage = resolveLanguage(lng);
  const authPath = buildLocalizedPath(currentLanguage, "/auth");
  const [, setUserProfile] = useState<{
    email: string | null;
    name: string | null;
  }>({ email: null, name: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const apiBase = useMemo(() => {
    const raw =
      import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "";
    const trimmed = raw.replace(/\/+$/, "");
    if (!trimmed) return "/api";
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }, []);
  const withLanguageParam = useCallback(
    (url: string) => {
      const separator = url.includes("?") ? "&" : "?";
      return `${url}${separator}lang=${currentLanguage}`;
    },
    [currentLanguage],
  );
  const fallbackDetailLabel = t("clientPortal.fallbacks.detail");
  const fallbackDetailValue = t("clientPortal.fallbacks.na");
  const fallbackSpecTitle = t("clientPortal.fallbacks.specifications");
  const fallbackModuleTitle = t("clientPortal.fallbacks.module");
  const fallbackModuleAction = t("clientPortal.fallbacks.request");
  const fallbackUntitledProduct = t("clientPortal.fallbacks.untitledProduct");
  const fallbackNoProducts = t("clientPortal.fallbacks.noProducts");
  const fallbackNoProductsSummary = t("clientPortal.fallbacks.noProductsSummary");
  const fallbackAdditionalTitle = t("clientPortal.fallbacks.additional");
  const fallbackNotesTitle = t("clientPortal.fallbacks.notesTitle");
  const fallbackNotesBody = t("clientPortal.fallbacks.notesBody");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncUserProfile = () => {
      const rawUser =
        localStorage.getItem("authUser") || sessionStorage.getItem("authUser");
      if (!rawUser) {
        setUserProfile({ email: null, name: null });
        return;
      }
      try {
        const parsed = JSON.parse(rawUser) as StoredUser;
        const email =
          typeof parsed.email === "string" ? parsed.email.trim() : null;
        const first =
          typeof parsed.first_name === "string" ? parsed.first_name.trim() : "";
        const last =
          typeof parsed.last_name === "string" ? parsed.last_name.trim() : "";
        const name =
          [first, last].filter(Boolean).join(" ").trim() ||
          (email ? email.split("@")[0] : null);
        setUserProfile({ email, name });
      } catch (error) {
        console.error("Unable to parse stored user", error);
        setUserProfile({ email: null, name: null });
      }
    };

    syncUserProfile();
    window.addEventListener("auth-updated", syncUserProfile);
    return () => window.removeEventListener("auth-updated", syncUserProfile);
  }, []);

  useEffect(() => {
    if (previewData) return;
    const token =
      (typeof window !== "undefined" &&
        (localStorage.getItem("authToken") ||
          sessionStorage.getItem("authToken"))) ||
      null;
    if (!token) {
      navigate(authPath, { replace: true });
    }
  }, [authPath, navigate, previewData]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickAway = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [menuOpen]);

  const [products, setProducts] = useState<Array<Product>>([]);
  const [selectedProductDetail, setSelectedProductDetail] =
    useState<PortalProductDetailApi | null>(null);

  useEffect(() => {
    if (previewData) {
      setProducts([{ slug: previewData.slug, name: previewData.name, category: previewData.category || "", serial: previewData.serial || "", preview_image: previewData.preview_image || "", images: previewData.images || [], summary: previewData.summary || "", highlight: previewData.highlight || "" }]);
      return;
    }
    const controller = new AbortController();

    const loadProducts = async () => {
      try {
        const response = await fetch(
          withLanguageParam(`${apiBase}/portal/products/`),
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error(`Unexpected response: ${response.status}`);
        }
        const payload = (await response.json()) as PortalProductApi[];
        const normalized = Array.isArray(payload)
          ? payload.map((item) => {
              const images = Array.isArray(item.images)
                ? item.images.filter((image): image is string => Boolean(image))
                : [];
              const previewImage = item.preview_image || images[0] || "";
              return {
                slug: item.slug,
                name: item.name || fallbackUntitledProduct,
                category: item.category || "",
                serial: item.serial || "",
                preview_image: previewImage,
                images,
                summary: item.summary || "",
                highlight: item.highlight || "",
              };
            })
          : [];
        setProducts(normalized);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "name" in error &&
          error.name === "AbortError"
        ) {
          return;
        }
        console.error("Unable to load portal products", error);
        setProducts([]);
      }
    };

    loadProducts();
    return () => controller.abort();
  }, [apiBase, fallbackUntitledProduct, withLanguageParam, previewData]);

  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(
    null,
  );
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<UpgradeModule | null>(null);
  const openContactModal = () => dispatchOpenContactModal();
  const openModuleModal = (module: UpgradeModule) => setActiveModule(module);
  const closeModuleModal = useCallback(() => setActiveModule(null), []);
  const closeGallery = useCallback(() => setIsGalleryOpen(false), []);
  const openGallery = useCallback((index: number) => {
    setActiveGalleryIndex(index);
    setIsGalleryOpen(true);
  }, []);

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: getProductKey(product),
        label: product.name,
      })),
    [products],
  );

  useEffect(() => {
    if (!products.length) {
      if (selectedProductKey !== null) {
        setSelectedProductKey(null);
      }
      return;
    }
    const defaultKey = getProductKey(products[0]);
    if (!selectedProductKey) {
      setSelectedProductKey(defaultKey);
      return;
    }
    const hasSelected = products.some(
      (product) => getProductKey(product) === selectedProductKey,
    );
    if (!hasSelected) {
      setSelectedProductKey(defaultKey);
    }
  }, [products, selectedProductKey]);

  const selectedProduct = useMemo(() => {
    if (!products.length) {
      return {
        name: fallbackNoProducts,
        category: "",
        serial: "",
        preview_image: "",
        images: [],
        summary: fallbackNoProductsSummary,
        highlight: "",
      };
    }
    if (selectedProductKey) {
      const match = products.find(
        (product) => getProductKey(product) === selectedProductKey,
      );
      if (match) {
        return match;
      }
    }
    return products[0];
  }, [
    fallbackNoProducts,
    fallbackNoProductsSummary,
    products,
    selectedProductKey,
  ]);
  const selectedProductSlug = selectedProduct?.slug ?? null;

  useEffect(() => {
    if (previewData) {
      setSelectedProductDetail(previewData);
      return;
    }
    if (!selectedProductSlug) {
      setSelectedProductDetail(null);
      return;
    }
    const controller = new AbortController();
    setSelectedProductDetail(null);

    const loadProductDetail = async () => {
      try {
        const response = await fetch(
          withLanguageParam(
            `${apiBase}/portal/products/${selectedProductSlug}/`,
          ),
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Unexpected response: ${response.status}`);
        }
        const payload = (await response.json()) as PortalProductDetailApi;
        setSelectedProductDetail(payload);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "name" in error &&
          error.name === "AbortError"
        ) {
          return;
        }
        console.error("Unable to load portal product detail", error);
        setSelectedProductDetail(null);
      }
    };

    loadProductDetail();
    return () => controller.abort();
  }, [apiBase, selectedProductSlug, withLanguageParam, previewData]);

  const specGroups = useMemo(() => {
    const characteristics = selectedProductDetail?.characteristics;
    const blocks = Array.isArray(characteristics?.blocks)
      ? characteristics.blocks
      : [];
    const looseItems = Array.isArray(characteristics?.items)
      ? characteristics.items
      : [];

    const groups = blocks.map((block, index) => {
      const items = Array.isArray(block.items) ? block.items : [];
      const normalizedItems = items
        .map((item) => {
          const label = (item.label || item.name || "").trim();
          const value = (item.value || item.description || "").trim();
          if (!label && !value) return null;
          return {
            label: label || fallbackDetailLabel,
            value: value || fallbackDetailValue,
          };
        })
        .filter((item): item is { label: string; value: string } =>
          Boolean(item),
        );
      const fallbackIcon = SPEC_ICON_POOL[index % SPEC_ICON_POOL.length];
      const iconPayload = block.icon;
      const iconUrl =
        iconPayload?.type === "upload" && typeof iconPayload.url === "string"
          ? iconPayload.url.trim()
          : "";
      const lucideName =
        iconPayload?.type === "lucide" && typeof iconPayload.name === "string"
          ? iconPayload.name
          : null;
      const resolvedIcon = lucideName ? resolveLucideIcon(lucideName) : null;
      return {
        title: (block.title || block.subtitle || fallbackSpecTitle).trim(),
        icon: resolvedIcon ?? fallbackIcon,
        iconUrl,
        items: normalizedItems,
      };
    });

    if (looseItems.length) {
      const normalizedLoose = looseItems
        .map((item) => {
          const label = (item.label || item.name || "").trim();
          const value = (item.value || item.description || "").trim();
          if (!label && !value) return null;
          return {
            label: label || fallbackDetailLabel,
            value: value || fallbackDetailValue,
          };
        })
        .filter((item): item is { label: string; value: string } =>
          Boolean(item),
        );
      if (normalizedLoose.length) {
        groups.push({
          title: fallbackAdditionalTitle,
          icon: SPEC_ICON_POOL[groups.length % SPEC_ICON_POOL.length],
          iconUrl: "",
          items: normalizedLoose,
        });
      }
    }

    return groups.filter((group) => group.items.length > 0);
  }, [
    fallbackAdditionalTitle,
    fallbackDetailLabel,
    fallbackDetailValue,
    fallbackSpecTitle,
    selectedProductDetail,
  ]);

  const textBlocks = useMemo(() => {
    const blocks = selectedProductDetail?.text_blocks;
    if (!Array.isArray(blocks)) {
      return [];
    }
    return blocks
      .map((block, index) => {
        const title = (block.title || "").trim();
        const text = (block.text || "").trim();
        if (!title && !text) return null;
        return {
          id: block.id ?? index,
          title: title || fallbackNotesTitle,
          text: text || fallbackNotesBody,
          order: typeof block.order === "number" ? block.order : index,
        };
      })
      .filter(
        (
          item,
        ): item is {
          id: number;
          title: string;
          text: string;
          order: number;
        } => Boolean(item),
      )
      .sort((a, b) => a.order - b.order)
      .map(({ order, ...rest }) => rest);
  }, [fallbackNotesBody, fallbackNotesTitle, selectedProductDetail]);

  const productGallery = useMemo(() => {
    const gallery = selectedProductDetail?.gallery;
    if (!Array.isArray(gallery)) {
      return [];
    }
    return [...gallery]
      .filter((item): item is PortalProductGalleryApi & { url: string } =>
        Boolean(item.url),
      )
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id,
      );
  }, [
    fallbackDetailLabel,
    fallbackDetailValue,
    fallbackModuleAction,
    fallbackModuleTitle,
    selectedProductDetail,
  ]);

  const presentationInfo = useMemo(() => {
    const items = selectedProductDetail?.presentation_info;
    if (!Array.isArray(items)) {
      return [];
    }
    return items
      .map((item, index) => {
        const title = (item.title || "").trim();
        const description = (item.description || "").trim();
        if (!title || !description) return null;
        return {
          id: item.id ?? index,
          title,
          description,
          order: typeof item.order === "number" ? item.order : index,
        };
      })
      .filter(
        (
          item,
        ): item is {
          id: number;
          title: string;
          description: string;
          order: number;
        } => Boolean(item),
      )
      .sort((a, b) => a.order - b.order || a.id - b.id)
      .map(({ order, ...rest }) => rest);
  }, [selectedProductDetail]);

  const tagBadges = useMemo(() => {
    const tags = selectedProductDetail?.tags;
    if (!Array.isArray(tags)) {
      return [];
    }
    return tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }, [selectedProductDetail]);

  const upgrades = useMemo<UpgradeModule[]>(() => {
    const modules = selectedProductDetail?.modules;
    const blocks = Array.isArray(modules?.blocks) ? modules.blocks : [];
    const looseItems = Array.isArray(modules?.items) ? modules.items : [];
    const blockItems = blocks.flatMap((block) =>
      Array.isArray(block.items) ? block.items : [],
    );
    const allModules = [...blockItems, ...looseItems];
    const blockMetaById = new Map(
      blocks.map((block) => [
        block.id,
        {
          title: block.title ?? "",
          subtitle: block.subtitle ?? "",
        },
      ]),
    );

    return allModules
      .map((module) => {
        const imageList = Array.isArray(module.images) ? module.images : [];
        const moduleImages = Array.isArray(module.module_images)
          ? module.module_images
          : [];
        const moduleCharacteristics = Array.isArray(
          module.module_characteristics,
        )
          ? module.module_characteristics
          : [];
        const normalizedModuleCharacteristics = moduleCharacteristics
          .map((item, index) => {
            const label = (item.label || item.name || "").trim();
            const value = (item.value || item.description || "").trim();
            if (!label && !value) return null;
            return {
              id: item.id ?? index,
              label: label || fallbackDetailLabel,
              value: value || fallbackDetailValue,
              order: typeof item.order === "number" ? item.order : index,
            };
          })
          .filter(
            (
              item,
            ): item is {
              id: number;
              label: string;
              value: string;
              order: number;
            } => Boolean(item),
          )
          .sort((a, b) => a.order - b.order)
          .map(({ order, ...rest }) => rest);
        const imageFromList = imageList[0] || moduleImages[0]?.url || "";
        const blockMeta = module.block_id
          ? blockMetaById.get(module.block_id)
          : undefined;
        return {
          id: module.id,
          title: module.title || module.name || fallbackModuleTitle,
          description: module.description || "",
          image: module.image || imageFromList || "",
          action: module.action || module.button_text || fallbackModuleAction,
          tag: module.tag || "",
          images: imageList,
          moduleImages,
          moduleCharacteristics: normalizedModuleCharacteristics,
          blockTitle: blockMeta?.title || "",
          blockSubtitle: blockMeta?.subtitle || "",
        };
      })
      .filter((module) => module.title);
  }, [selectedProductDetail]);

  const activeModuleImages = useMemo(() => {
    if (!activeModule) return [];
    if (activeModule.moduleImages.length > 0) {
      return activeModule.moduleImages;
    }
    if (activeModule.images.length > 0) {
      return activeModule.images.map((url, index) => ({
        id: index,
        url,
        alt: "",
      }));
    }
    if (activeModule.image) {
      return [
        {
          id: 0,
          url: activeModule.image,
          alt: "",
        },
      ];
    }
    return [];
  }, [activeModule]);

  const moduleSummaryItems = useMemo(() => {
    if (!activeModule) return [];
    const items: Array<{ label: string; value: string }> = [];

    const addItem = (label: string, value?: string | null) => {
      const trimmed = value?.trim();
      if (trimmed) {
        items.push({ label, value: trimmed });
      }
    };

    if (activeModule.moduleCharacteristics.length) {
      activeModule.moduleCharacteristics.forEach((item) =>
        addItem(item.label, item.value),
      );
    }

    return items;
  }, [activeModule, activeModuleImages]);

  const productImages =
    selectedProduct?.images?.length && selectedProduct.images.length > 0
      ? selectedProduct.images
      : selectedProduct?.preview_image
        ? [selectedProduct.preview_image]
        : [];
  const hasMultipleImages = productImages.length > 1;
  const hasMultipleGalleryImages = productGallery.length > 1;
  const clampedGalleryIndex =
    productGallery.length > 0
      ? Math.min(activeGalleryIndex, productGallery.length - 1)
      : 0;
  const activeGalleryItem =
    productGallery.length > 0 ? productGallery[clampedGalleryIndex] : null;
  const isOverlayOpen = Boolean(activeModule) || isGalleryOpen;

  useEffect(() => {
    setActiveMediaIndex(0);
    setActiveGalleryIndex(0);
    setIsGalleryOpen(false);
  }, [selectedProductKey]);

  useEffect(() => {
    if (!productGallery.length) {
      if (isGalleryOpen) {
        setIsGalleryOpen(false);
      }
      if (activeGalleryIndex !== 0) {
        setActiveGalleryIndex(0);
      }
      return;
    }
    if (activeGalleryIndex > productGallery.length - 1) {
      setActiveGalleryIndex(productGallery.length - 1);
    }
  }, [activeGalleryIndex, isGalleryOpen, productGallery.length]);

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", isOverlayOpen);
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isOverlayOpen]);

  useEffect(() => {
    if (!activeModule) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModuleModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModule, closeModuleModal]);

  const showPreviousImage = useCallback(() => {
    setActiveMediaIndex((current) => {
      if (!productImages.length) return current;
      return (current - 1 + productImages.length) % productImages.length;
    });
  }, [productImages.length]);

  const showNextImage = useCallback(() => {
    setActiveMediaIndex((current) => {
      if (!productImages.length) return current;
      return (current + 1) % productImages.length;
    });
  }, [productImages.length]);

  const showPreviousGalleryImage = useCallback(() => {
    setActiveGalleryIndex((current) => {
      if (!productGallery.length) return current;
      return (current - 1 + productGallery.length) % productGallery.length;
    });
  }, [productGallery.length]);

  const showNextGalleryImage = useCallback(() => {
    setActiveGalleryIndex((current) => {
      if (!productGallery.length) return current;
      return (current + 1) % productGallery.length;
    });
  }, [productGallery.length]);

  useEffect(() => {
    if (!isGalleryOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeGallery();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextGalleryImage();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousGalleryImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeGallery,
    isGalleryOpen,
    showNextGalleryImage,
    showPreviousGalleryImage,
  ]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black/25 pt-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(46,126,255,0.12),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(91,194,255,0.16),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(34,197,94,0.1),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_40%,transparent_65%)]" />
      </div>

      <div className="relative z-10 pt-12 pb-16 lg:pt-16">
        {products.length > 0 ? (
          <>
            <section className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="container">
                    <div
                      className={`flex items-center justify-between max-md:justify-center ${!productImages.length ? "max-md:flex-col" : ""}`}
                    >
                      <div className="max-md:text-center">
                        <p className="text-foreground/70 font-semibold tracking-widest uppercase max-md:text-center">
                          {t("clientPortal.hero.kicker")}
                        </p>
                        <h1 className="text-foreground text-4xl font-semibold max-md:text-3xl">
                          {selectedProduct.name}
                        </h1>
                      </div>
                      {!productImages.length ? (
                        <div>
                          <ProductDropdown
                            id="product-select-desktop"
                            label={t("clientPortal.productSelector.label", {
                              count: products.length,
                            })}
                            value={selectedProductKey}
                            options={productOptions}
                            disabled={!productOptions.length}
                            variant="desktop"
                            onChange={(nextValue) =>
                              setSelectedProductKey(nextValue)
                            }
                          />
                        </div>
                      ) : (
                        <div className="hidden md:block">
                          <ProductDropdown
                            id="product-select-desktop"
                            label={t("clientPortal.productSelector.label", {
                              count: products.length,
                            })}
                            value={selectedProductKey}
                            options={productOptions}
                            disabled={!productOptions.length}
                            variant="desktop"
                            onChange={(nextValue) =>
                              setSelectedProductKey(nextValue)
                            }
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {productImages.length ? (
                  <div className="relative hidden min-h-75 max-md:mb-16 max-md:block">
                    <div className="relative h-full">
                      {productImages.map((imageSrc, index) => (
                        <img
                          key={`${selectedProduct.name}-${index}`}
                          src={imageSrc}
                          alt={t("clientPortal.media.productImageAlt", {
                            name: selectedProduct.name,
                            index: index + 1,
                          })}
                          className={`absolute inset-0 transition duration-300 ease-out ${
                            index === activeMediaIndex
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                      ))}
                    </div>

                    {hasMultipleImages ? (
                      <>
                        <div className="pointer-events-none absolute inset-y-0 right-0 left-0 container flex items-center justify-between px-3 sm:px-4">
                          <button
                            type="button"
                            onClick={showPreviousImage}
                            aria-label={t("clientPortal.media.previousImage")}
                            className="pointer-events-auto inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-slate-950/60 text-white shadow-lg transition hover:border-white/30 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:outline-none"
                          >
                            <ChevronLeft
                              className="h-5 w-5"
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={showNextImage}
                            aria-label={t("clientPortal.media.nextImage")}
                            className="pointer-events-auto inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-slate-950/60 text-white shadow-lg transition hover:border-white/30 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:outline-none"
                          >
                            <ChevronRight
                              className="h-5 w-5"
                              aria-hidden="true"
                            />
                          </button>
                        </div>

                        <div className="pointer-events-none absolute bottom-10 left-1/2 flex -translate-x-1/2 gap-2">
                          {productImages.map((_, index) => (
                            <button
                              key={`${selectedProduct.name}-dot-${index}`}
                              type="button"
                              aria-label={t("clientPortal.media.imageIndex", {
                                index: index + 1,
                                count: productImages.length,
                              })}
                              onClick={() => setActiveMediaIndex(index)}
                              className={`pointer-events-auto h-2.5 w-2.5 cursor-pointer rounded-full border transition ${
                                index === activeMediaIndex
                                  ? "border-white/70 bg-white"
                                  : "border-white/30 bg-white/20 hover:border-white/60"
                              }`}
                            />
                          ))}
                        </div>

                        <div className="absolute right-4 bottom-8 rounded-full bg-slate-950/60 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
                          {activeMediaIndex + 1} / {productImages.length}
                        </div>
                        <div className="absolute inset-x-0 -bottom-12 container py-3">
                          <ProductDropdown
                            id="product-select-mobile"
                            label={t("clientPortal.productSelector.label", {
                              count: products.length,
                            })}
                            value={selectedProductKey}
                            options={productOptions}
                            disabled={!productOptions.length}
                            variant="mobile"
                            onChange={(nextValue) =>
                              setSelectedProductKey(nextValue)
                            }
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="container grid grid-cols-1 gap-6">
                <article className="border-border/10 overflow-hidden rounded-3xl border bg-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
                  <div className="grid lg:grid-cols-2">
                    <div className="relative min-h-80 overflow-hidden max-md:hidden">
                      <div className="relative h-full">
                        {productImages.map((imageSrc, index) => (
                        <img
                          key={`${selectedProduct.name}-${index}`}
                          src={imageSrc}
                          alt={t("clientPortal.media.productImageAlt", {
                            name: selectedProduct.name,
                            index: index + 1,
                          })}
                          className={`absolute inset-0 transition duration-700 ease-out ${
                            index === activeMediaIndex
                              ? "opacity-100"
                              : "opacity-0"
                            }`}
                          />
                        ))}
                      </div>

                      {hasMultipleImages ? (
                        <>
                          <div className="pointer-events-none absolute inset-y-0 right-0 left-0 flex items-center justify-between px-3 sm:px-4">
                            <button
                              type="button"
                              onClick={showPreviousImage}
                              aria-label={t("clientPortal.media.previousImage")}
                              className="pointer-events-auto inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-slate-950/60 text-white shadow-lg transition hover:border-white/30 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:outline-none"
                            >
                              <ChevronLeft
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            </button>
                            <button
                              type="button"
                              onClick={showNextImage}
                              aria-label={t("clientPortal.media.nextImage")}
                              className="pointer-events-auto inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-slate-950/60 text-white shadow-lg transition hover:border-white/30 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:outline-none"
                            >
                              <ChevronRight
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            </button>
                          </div>

                          <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                            {productImages.map((_, index) => (
                            <button
                              key={`${selectedProduct.name}-dot-${index}`}
                              type="button"
                              aria-label={t("clientPortal.media.imageIndex", {
                                index: index + 1,
                                count: productImages.length,
                              })}
                              onClick={() => setActiveMediaIndex(index)}
                              className={`pointer-events-auto h-2.5 w-2.5 cursor-pointer rounded-full border transition ${
                                index === activeMediaIndex
                                  ? "border-white/70 bg-white"
                                    : "border-white/30 bg-white/20 hover:border-white/60"
                                }`}
                              />
                            ))}
                          </div>

                          <div className="absolute right-4 bottom-4 rounded-full bg-slate-950/60 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
                            {activeMediaIndex + 1} / {productImages.length}
                          </div>
                        </>
                      ) : null}
                    </div>
                    <div className="flex flex-col justify-between gap-6 p-5">
                      <div className="space-y-3">
                        <p className="text-sm font-semibold tracking-[0.18em] text-white/60 uppercase">
                          {t("clientPortal.overview.serial", {
                            serial: selectedProduct.serial,
                          })}
                        </p>
                        <h3 className="text-2xl font-semibold text-white">
                          {t("clientPortal.overview.title")}
                        </h3>
                        <p className="text-sm text-white/65">
                          {selectedProduct.summary}
                        </p>
                        {tagBadges.length ? (
                          <div className="flex flex-wrap gap-2">
                            {tagBadges.map((tag, index) => (
                              <span
                                key={`${tag}-${index}`}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                          <p className="text-xs tracking-[0.18em] text-white/50 uppercase">
                            {t("clientPortal.overview.cards.ownership.label")}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {t("clientPortal.overview.cards.ownership.value")}
                          </p>
                          <p className="text-xs text-white/60">
                            {t("clientPortal.overview.cards.ownership.note")}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                          <p className="text-xs tracking-[0.18em] text-white/50 uppercase">
                            {t(
                              "clientPortal.overview.cards.documentation.label",
                            )}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-white">
                            {t(
                              "clientPortal.overview.cards.documentation.value",
                            )}
                          </p>
                          <p className="text-xs text-white/60">
                            {t(
                              "clientPortal.overview.cards.documentation.note",
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
                {specGroups.length > 0 ? (
                  <div
                    id="tech-specs"
                    className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] lg:p-7"
                  >
                    <ScrollReveal>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
                            {t("clientPortal.specs.kicker")}
                          </p>
                          <h3 className="text-xl font-semibold text-white">
                            {t("clientPortal.specs.title")}
                          </h3>
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sky-100">
                          <FileText className="h-5 w-5" aria-hidden="true" />
                        </div>
                      </div>
                    </ScrollReveal>
                    <div className="mt-5 grid grid-cols-1 gap-4">
                      {specGroups.map((group, index) => (
                        <ScrollReveal key={`${group.title}-${index}`}>
                          <div
                            className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm max-md:text-xs"
                          >
                            <div className="flex items-center gap-3 text-sm">
                              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sky-100">
                                {group.iconUrl ? (
                                  <img
                                    src={group.iconUrl}
                                    alt=""
                                    className="h-5 w-5"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <group.icon
                                    className="h-5 w-5"
                                    aria-hidden="true"
                                  />
                                )}
                              </span>
                              <p className="font-semibold text-white">
                                {group.title}
                              </p>
                            </div>
                            <ul className="mt-3 space-y-2 text-white/70">
                              {group.items.map((item) => (
                                <li
                                  key={item.label}
                                  className="flex items-start justify-between gap-3 rounded-lg bg-slate-900/60 px-3 py-2"
                                >
                                  <span>{item.label}</span>
                                  <span className="text-right font-semibold wrap-break-word text-white max-md:max-w-25">
                                    {item.value}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </ScrollReveal>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
            {productGallery.length ? (
              <section className="container mt-12 space-y-5">
                <ScrollReveal>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
                        {t("clientPortal.gallery.kicker")}
                      </p>
                      <h2 className="text-2xl font-semibold text-white">
                        {t("clientPortal.gallery.title")}
                      </h2>
                      <p className="text-sm text-white/65">
                        {t("clientPortal.gallery.description")}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
                      {t("clientPortal.gallery.assets", {
                        count: productGallery.length,
                      })}
                    </span>
                  </div>
                </ScrollReveal>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {productGallery.map((image, index) => {
                    const isActive =
                      isGalleryOpen && index === clampedGalleryIndex;
                    return (
                      <ScrollReveal
                        key={image.id ?? `${image.url}-${index}`}
                      >
                        <button
                          type="button"
                          onClick={() => openGallery(index)}
                          aria-label={t("clientPortal.gallery.openImage", {
                            index: index + 1,
                            count: productGallery.length,
                          })}
                          className={`group relative cursor-pointer overflow-hidden rounded-3xl border bg-white/5 shadow-[0_25px_70px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 ${
                            isActive ? "border-sky-400/60" : "border-white/10"
                          }`}
                        >
                          <div className="relative aspect-4/3 w-full overflow-hidden">
                            <img
                              src={image.url}
                              alt={
                                image.alt ||
                                t("clientPortal.gallery.imageAlt", {
                                  name: selectedProduct.name,
                                  index: index + 1,
                                })
                              }
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
                            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                            <div className="pointer-events-none absolute bottom-3 left-3 text-xs font-semibold tracking-[0.2em] text-white/80 uppercase opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                              {t("clientPortal.gallery.viewImage")}
                            </div>
                          </div>
                        </button>
                      </ScrollReveal>
                    );
                  })}
                </div>
              </section>
            ) : null}
            {presentationInfo.length ? (
              <section className="container mt-12 space-y-6">
                {presentationInfo.map((item) => (
                  <ScrollReveal key={item.id}>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="leading-7 whitespace-pre-line text-white/70">
                        {item.description}
                      </p>
                    </div>
                  </ScrollReveal>
                ))}
              </section>
            ) : null}
            {textBlocks.length ? (
              <section className="container mt-12">
                <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
                  <ScrollReveal>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
                          {t("clientPortal.notes.kicker")}
                        </p>
                        <h3 className="text-xl font-semibold text-white">
                          {t("clientPortal.notes.title")}
                        </h3>
                      </div>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sky-100">
                        <FileText className="h-5 w-5" aria-hidden="true" />
                      </div>
                    </div>
                  </ScrollReveal>

                  <div className="mt-5 columns-1 gap-x-4 md:columns-2">
                    {textBlocks.map((block) => (
                      <ScrollReveal
                        key={block.id}
                        className="mb-4 break-inside-avoid"
                      >
                        <article className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                          <h4 className="text-base font-semibold text-white">
                            {block.title}
                          </h4>
                          <p className="mt-2 leading-relaxed whitespace-pre-line text-white/70">
                            {block.text}
                          </p>
                        </article>
                      </ScrollReveal>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <div className="container flex flex-col items-center justify-center">
            <h1 className="text-foreground text-center text-3xl leading-15 font-bold max-lg:leading-10 md:text-4xl xl:text-5xl">
              {t("clientPortal.empty.title")} <br />
              {t("clientPortal.empty.subtitle")}
            </h1>
            <div className="mt-12">
              <a
                onClick={openContactModal}
                className="group relative inline-flex h-14 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-white px-8 text-lg font-bold text-black uppercase transition-all duration-300 ease-out will-change-transform hover:shadow-[inset_0_3px_12px_rgba(255,255,255,0.35),inset_0_-6px_20px_rgba(0,0,0,0.45)] active:scale-[0.93] active:shadow-[inset_0_1px_6px_rgba(255,255,255,0.5),inset_0_-8px_22px_rgba(0,0,0,0.65)] max-md:h-12 max-md:text-base"
              >
                {t("clientPortal.actions.contact")}
              </a>
            </div>
          </div>
        )}
        {upgrades.length ? (
          <section className="container mt-12 space-y-5">
            <ScrollReveal>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
                    {t("clientPortal.upgrades.kicker")}
                  </p>
                  <h2 className="text-2xl font-semibold text-white">
                    {t("clientPortal.upgrades.title")}
                  </h2>
                </div>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {upgrades.map((upgrade) => (
                <ScrollReveal>
                  <article
                    key={upgrade.title}
                    onClick={() => openModuleModal(upgrade)}
                    className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.32)] transition"
                  >
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={upgrade.image}
                        alt={upgrade.title}
                        className="flex h-full w-full items-center justify-center object-cover text-center text-lg font-medium transition duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold text-white">
                          {upgrade.title}
                        </h3>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-wide text-nowrap text-white/60 uppercase">
                          {t("clientPortal.upgrades.badge")}
                        </span>
                      </div>
                      <p className="text-sm text-white/65">
                        {upgrade.description}
                      </p>
                      <button
                        type="button"
                        onClick={() => openModuleModal(upgrade)}
                        className="mt-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-sky-300/60 hover:bg-sky-400/15 focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:outline-none"
                      >
                        {upgrade.action}
                      </button>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </section>
        ) : null}
        {products.length > 0 ? (
          <section className="container mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
            <ScrollReveal>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
                <p className="text-sm font-semibold tracking-widest text-white/50 uppercase">
                  {t("clientPortal.summary.kicker")}
                </p>
                <h1 className="mt-3 text-3xl leading-tight font-semibold text-white md:text-4xl">
                  {t("clientPortal.summary.title")}
                </h1>
                <p className="mt-3 text-base text-white/65">
                  {t("clientPortal.summary.description")}
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold tracking-[0.18em] text-white/50 uppercase">
                      {t("clientPortal.summary.cards.products.label")}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-white">
                      {products.length}
                      <span className="text-2xl font-semibold text-emerald-300">
                        {t("clientPortal.summary.cards.products.value")}
                      </span>
                    </div>
                    <p className="text-sm text-white/60">
                      {t("clientPortal.summary.cards.products.note")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold tracking-[0.18em] text-white/50 uppercase">
                      {t("clientPortal.summary.cards.clearance.label")}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-white">
                      {t("clientPortal.summary.cards.clearance.value")}
                    </div>
                    <p className="text-sm text-white/60">
                      {t("clientPortal.summary.cards.clearance.note")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold tracking-[0.18em] text-white/50 uppercase">
                      {t("clientPortal.summary.cards.documents.label")}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-white">
                      {t("clientPortal.summary.cards.documents.value")}
                    </div>
                    <p className="text-sm text-white/60">
                      {t("clientPortal.summary.cards.documents.note")}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal className="flex items-center">
              <div className="h-fit space-y-3 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
                <p className="text-sm font-semibold tracking-widest text-white/50 uppercase">
                  {t("clientPortal.lineup.title")}
                </p>
                <div className="grid max-h-48.75 grid-cols-1 gap-3 overflow-scroll">
                  {products.map((product) => {
                    const productKey = getProductKey(product);
                    const isSelected = selectedProductKey === productKey;
                    return (
                      <button
                        key={productKey}
                        type="button"
                        onClick={() => setSelectedProductKey(productKey)}
                        aria-pressed={isSelected}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:outline-none ${
                          isSelected
                            ? "border-sky-400/60 bg-sky-400/15"
                            : "border-white/10 bg-white/5"
                        }`}
                      >
                        <div className="flex gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-100">
                            <Package2 className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <div className="leading-tight">
                            <p className="text-sm font-semibold text-white">
                              {product.name}
                            </p>
                            <p className="text-xs text-white/60">
                              {product.serial}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-foreground/70 tracking-wider">
                  {t("clientPortal.lineup.note")}
                </p>
              </div>
            </ScrollReveal>
          </section>
        ) : null}
        <ScrollReveal>
          <section className="container mt-12">
            <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/80 p-5 text-sm text-white/70 shadow-[0_20px_50px_rgba(0,0,0,0.35)] md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col items-start gap-3 md:flex-row">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sky-100">
                  <Lock className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
                    {t("clientPortal.security.kicker")}
                  </p>
                  <p className="text-sm text-white">
                    {t("clientPortal.security.message")}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-center text-[11px] font-semibold tracking-[0.14em] text-nowrap text-white/70 uppercase">
                {t("clientPortal.security.badge")}
              </span>
            </div>
          </section>
        </ScrollReveal>
        {isGalleryOpen && productGallery.length ? (
          <div className="fixed inset-0 z-999 flex items-start justify-center overflow-y-auto pt-12">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={closeGallery}
            />
            <div
              className="relative z-10 container w-full pt-24 pb-8"
              role="dialog"
              aria-modal="true"
              aria-label={t("clientPortal.gallery.modalLabel")}
            >
              <div className="relative max-h-[calc(100vh-8rem)] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl">
                <button
                  type="button"
                  onClick={closeGallery}
                  aria-label={t("clientPortal.gallery.close")}
                  className="absolute top-4 right-4 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                >
                  <X className="h-4 w-4" />
                </button>
                {hasMultipleGalleryImages ? (
                  <>
                    <button
                      type="button"
                      onClick={showPreviousGalleryImage}
                      aria-label={t("clientPortal.media.previousImage")}
                      className="absolute top-1/2 left-4 z-20 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                    >
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={showNextGalleryImage}
                      aria-label={t("clientPortal.media.nextImage")}
                      className="absolute top-1/2 right-4 z-20 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                    >
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </>
                ) : null}
                <div className="relative w-full bg-black/40">
                  <img
                    src={activeGalleryItem?.url ?? ""}
                    alt={
                      activeGalleryItem?.alt ||
                      t("clientPortal.gallery.imageAlt", {
                        name: selectedProduct.name,
                        index: clampedGalleryIndex + 1,
                      })
                    }
                    className="max-h-[calc(100vh-16rem)] w-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-white/60">
                  <span className="font-semibold text-white/80">
                    {clampedGalleryIndex + 1} / {productGallery.length}
                  </span>
                  <span className="truncate">{selectedProduct.name}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {activeModule ? (
          <div className="fixed inset-0 z-999 flex items-start justify-center pt-36 pb-10">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={closeModuleModal}
            />
            <div className="relative z-10 w-full">
              <div className="container">
                <div
                  className="relative max-h-[calc(100vh-9rem)] overflow-x-hidden overflow-y-scroll rounded-3xl border border-white/10 bg-slate-950/95 p-5 text-white shadow-xl"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t("clientPortal.modules.modalLabel")}
                >
                  <button
                    type="button"
                    onClick={closeModuleModal}
                    className="absolute top-2 right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-6">
                      <div className="overflow-x-auto pb-2">
                        {activeModuleImages.length ? (
                          <div className="flex max-w-64 gap-3">
                            {activeModuleImages.map((image) => (
                              <div
                                key={image.id}
                                className="relative aspect-4/3 w-64 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:w-72 lg:w-80"
                              >
                                <img
                                  src={image.url}
                                  alt={image.alt || activeModule.title}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                            {t("clientPortal.modules.imagesUnavailable")}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-4xl font-semibold text-white">
                          {activeModule.title}
                        </h3>
                        <div>
                          {activeModule.description ? (
                            <p className="text-base text-white/70">
                              {activeModule.description}
                            </p>
                          ) : (
                            <p className="text-sm text-white/50">
                              {t("clientPortal.modules.descriptionUnavailable")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
                          {t("clientPortal.modules.detailsTitle")}
                        </p>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-wide text-nowrap text-white/60 uppercase">
                          {activeModule.tag || t("clientPortal.upgrades.badge")}
                        </span>
                      </div>
                      <div className="mt-4 flex max-h-68 flex-col gap-2 overflow-scroll">
                        {moduleSummaryItems.map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-sm"
                          >
                            <span className="text-white/60">{item.label}</span>
                            <span className="text-right font-semibold text-white">
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
