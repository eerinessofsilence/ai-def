import i18n, { type ResourceLanguage } from "i18next";
import { initReactI18next } from "react-i18next";

const MAIN_LANGUAGES = [
  "en",
  "de",
  "sk",
  "es",
  "fr",
  "it",
] as const;
export const isArmsStoreHost =
  typeof window !== "undefined" && window.location.hostname === "arms.ai-def.com";
export type SupportedLanguage = (typeof MAIN_LANGUAGES)[number] | "ru";
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = isArmsStoreHost
  ? [...MAIN_LANGUAGES, "ru"]
  : MAIN_LANGUAGES;
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

export const isSupportedLanguage = (
  value?: string,
): value is SupportedLanguage =>
  SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);

export const resolveLanguage = (value?: string): SupportedLanguage =>
  isSupportedLanguage(value) ? value : DEFAULT_LANGUAGE;

export const localeLoaders: Record<
  SupportedLanguage,
  () => Promise<{ default: ResourceLanguage }>
> = {
  en: () => import("./locales/en/common.json"),
  de: () => import("./locales/de/common.json"),
  sk: () => import("./locales/sk/common.json"),
  es: () => import("./locales/es/common.json"),
  fr: () => import("./locales/fr/common.json"),
  it: () => import("./locales/it/common.json"),
  ru: () => import("./locales/ru/common.json"),
};

const loadedLanguages = new Set<SupportedLanguage>();

const detectInitialLanguage = (): SupportedLanguage => {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const [, maybeLanguage] = window.location.pathname.split("/");
  return resolveLanguage(maybeLanguage);
};

export const stripSupportedLanguageFromPath = (path: string) => {
  if (!path.startsWith("/")) return path;

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0 || !isSupportedLanguage(segments[0])) {
    return path || "/";
  }

  const pathWithoutLanguage = `/${segments.slice(1).join("/")}`;
  return pathWithoutLanguage === "/" ? "/" : pathWithoutLanguage;
};

export const buildLocalizedPath = (lng: SupportedLanguage, path: string) => {
  if (!path.startsWith("/")) return path;

  const pathWithoutLanguage = stripSupportedLanguageFromPath(path);
  if (lng === DEFAULT_LANGUAGE) return pathWithoutLanguage;
  if (pathWithoutLanguage === "/") return `/${lng}`;
  return `/${lng}${pathWithoutLanguage}`;
};

export const replaceLanguageInPath = (
  pathname: string,
  nextLng: SupportedLanguage,
) => {
  return buildLocalizedPath(nextLng, stripSupportedLanguageFromPath(pathname));
};

export const ensureLanguageResources = async (value?: string) => {
  const language = resolveLanguage(value);

  if (loadedLanguages.has(language)) {
    return;
  }

  const messages = (await localeLoaders[language]()).default;
  i18n.addResourceBundle(language, "common", messages, true, true);
  loadedLanguages.add(language);
};

const initialLanguage = detectInitialLanguage();

i18n.use(initReactI18next);

export const i18nReady = i18n
  .init({
    resources: {},
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: "common",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
  .then(async () => {
    await ensureLanguageResources(initialLanguage);
    if (i18n.language !== initialLanguage) {
      await i18n.changeLanguage(initialLanguage);
    }
  });

export default i18n;
