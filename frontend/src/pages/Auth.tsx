import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { buildLocalizedPath, resolveLanguage } from "../i18n";
import { Fingerprint, Eye, EyeClosed, ChevronDown } from "lucide-react";

type AuthResponse = {
  token: string;
  user: {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  };
};

type AuthCopy = {
  title: string;
  description: string;
  cta: string;
  kicker?: string;
};

type CountryOption = {
  code: string;
  name: string;
};

type ProductOption = {
  value: string;
  label: string;
};

type RestCountry = {
  cca2?: string;
  name?: { common?: string };
};

const fallbackCountries: CountryOption[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "DK", name: "Denmark" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "KE", name: "Kenya" },
  { code: "NG", name: "Nigeria" },
];

const buildCountryOptions = (language = "en"): CountryOption[] => {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };

  const canUseIntl =
    typeof intl.supportedValuesOf === "function" &&
    typeof Intl.DisplayNames === "function";

  if (canUseIntl) {
    try {
      const displayNames = new Intl.DisplayNames([language], { type: "region" });
      return intl
        .supportedValuesOf("region")
        .filter((code) => /^[A-Z]{2}$/.test(code))
        .map((code) => ({
          code,
          name: displayNames.of(code) ?? code,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      // Fallback for environments without full Intl coverage.
    }
  }

  return fallbackCountries;
};

const getCountryOptionLabel = (country: CountryOption) =>
  `${country.name} (${country.code})`;


export default function Auth() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInSuccess, setSignInSuccess] = useState<string | null>(null);
  const [signUpSuccess, setSignUpSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const countryDatalistId = useId();
  const [countries, setCountries] = useState<CountryOption[]>(() =>
    buildCountryOptions(i18n.language),
  );
  const [countryQuery, setCountryQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(
    null,
  );
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const navigate = useNavigate();
  const { lng } = useParams();
  const currentLanguage = resolveLanguage(lng);
  const withLanguage = (path: string) =>
    buildLocalizedPath(currentLanguage, path);
  const isSignUp = mode === "signup";

  const API_BASE = (() => {
    const raw =
      import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "";
    const trimmed = raw.replace(/\/+$/, "");
    if (!trimmed) return "/api";
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  })();

  const copy: { signin: AuthCopy; signup: AuthCopy } = {
    signin: {
      title: t("auth.signin.title"),
      description: t("auth.signin.description"),
      cta: t("auth.signin.cta"),
    },
    signup: {
      kicker: t("auth.signup.kicker"),
      title: t("auth.signup.title"),
      description: t("auth.signup.description"),
      cta: t("auth.signup.cta"),
    },
  };
  const activeCopy = isSignUp ? copy.signup : copy.signin;

  const inputClass =
    "text-foreground placeholder:text-foreground/50 focus:border-foreground/50 focus:ring-foreground/40 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base transition focus:ring-2 focus:outline-none";
  const selectClass = `${inputClass} appearance-none pr-12`;
  const productOptions: ProductOption[] = [
    { value: "all-products", label: t("auth.products.all") },
    { value: "ax2ng-krakatit", label: "AX2NG KRAKATIT" },
    { value: "av-1-vtol", label: "AV-1 VTOL" },
    { value: "axq-quadrocopter", label: "AXQ QUADROCOPTER" },
    { value: "ground-control-station", label: "Ground Control Station" },
    { value: "ugv-150-dup", label: "UGV 150-DUP" },
    {
      value: "strategic-partnership",
      label: t("auth.products.partnership"),
    },
  ];

  const extractErrorMessage = (data: unknown) => {
    if (!data || typeof data !== "object") {
      return t("auth.errors.unexpectedResponse");
    }
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;

    const [firstKey] = Object.keys(record);
    const value = record[firstKey];
    if (Array.isArray(value) && value.length && typeof value[0] === "string") {
      return value[0];
    }
    if (typeof value === "string") return value;
    return t("auth.errors.requestFailed");
  };

  const filteredCountries = useMemo(() => {
    if (!countryQuery) {
      return countries;
    }
    const query = countryQuery.toLowerCase();
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(query) ||
        country.code.toLowerCase().includes(query),
    );
  }, [countries, countryQuery]);

  const findCountryFromInput = useCallback(
    (value: string) => {
      const normalized = value.trim().toLowerCase();
      return (
        countries.find((country) => {
          const label = getCountryOptionLabel(country).toLowerCase();
          return (
            label === normalized ||
            country.name.toLowerCase() === normalized ||
            country.code.toLowerCase() === normalized
          );
        }) ?? null
      );
    },
    [countries],
  );

  useEffect(() => {
    const controller = new AbortController();
    const fetchCountries = async () => {
      setIsLoadingCountries(true);
      setCountryError(null);
      try {
        const response = await fetch(
          "https://restcountries.com/v3.1/all?fields=name,cca2",
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }
        const payload = (await response.json()) as RestCountry[];
        const dynamicCountries = Array.isArray(payload)
          ? payload
              .filter(
                (
                  item,
                ): item is RestCountry & {
                  cca2: string;
                  name: { common: string };
                } => Boolean(item?.name?.common && item?.cca2),
              )
              .map((item) => ({
                code: item.cca2.toUpperCase(),
                name: item.name.common,
              }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : [];
        if (dynamicCountries.length > 0) {
          setCountries(dynamicCountries);
          return;
        }
        setCountries(buildCountryOptions(i18n.language));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Unable to load countries", error);
        setCountryError(t("auth.errors.countryLoad"));
        setCountries(buildCountryOptions(i18n.language));
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCountries(false);
        }
      }
    };

    fetchCountries();
    return () => controller.abort();
  }, [i18n.language, t]);

  const handleModeChange = (nextMode: "signup" | "signin") => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setSignInError(null);
    setSignInSuccess(null);
    setSignUpSuccess(null);
    setCountryError(null);
  };

  const handleCountryInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCountryQuery(value);
    setCountryError(null);

    const match = findCountryFromInput(value);
    setSelectedCountry(match);
  };

  const handleCountryBlur = () => {
    const match = findCountryFromInput(countryQuery);
    if (match) {
      setSelectedCountry(match);
      setCountryQuery(match.name);
    }
  };

  const handleProductChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedProduct(event.target.value);
  };

  const handleSignUpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignUpSuccess(null);

    const match = selectedCountry ?? findCountryFromInput(countryQuery);
    if (!match) {
      setCountryError(t("auth.errors.countryRequired"));
      return;
    }
    setSelectedCountry(match);
    setSignUpSuccess(t("auth.success.signup"));
  };

  const handleSignInSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignInError(null);
    setSignInSuccess(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString().trim();
    const password = formData.get("password")?.toString();
    const remember = formData.get("remember") === "on";

    if (!email || !password) {
      setSignInError(t("auth.errors.missingCredentials"));
      return;
    }

    const payload = { email, password };
    const endpoint = "/auth/login/";

    try {
      setSignInLoading(true);
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSignInError(extractErrorMessage(data));
        return;
      }

      const parsed = data as Partial<AuthResponse>;
      const storage = remember ? localStorage : sessionStorage;
      if (typeof parsed.token === "string") {
        if (parsed.user && typeof parsed.user === "object") {
          const account = { token: parsed.token, user: parsed.user };
          const saved = localStorage.getItem("authAccounts");
          let accounts: Array<{ token: string; user: AuthResponse["user"] }> = [];
          try {
            accounts = saved ? JSON.parse(saved) : [];
          } catch {
            accounts = [];
          }
          accounts = accounts.filter((item) => item.user?.email !== parsed.user?.email);
          accounts.push(account);
          storage.setItem("authAccounts", JSON.stringify(accounts));
        }
        storage.setItem("authToken", parsed.token);
      }
      if (parsed.user && typeof parsed.user === "object") {
        storage.setItem("authUser", JSON.stringify(parsed.user));
      }

      setSignInSuccess(t("auth.success.signin"));
      window.dispatchEvent(new Event("auth-updated"));
      navigate(withLanguage("/client-portal"), { replace: true });
    } catch (err) {
      console.error(err);
      setSignInError(t("auth.errors.network"));
    } finally {
      setSignInLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden py-32">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-10 left-10 h-72 w-72 rounded-full bg-[#1f3b68] opacity-60 blur-3xl md:h-96 md:w-96" />
        <div className="absolute bottom-[-15%] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#243b63] opacity-70 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_0,rgba(255,255,255,0.06),transparent_30%)]" />
      </div>

      <div className="relative container">
        <div className="mx-auto max-w-140">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-white/8 via-white/4 to-white/2 blur-3xl" />
            <div className="relative rounded-3xl border border-white/10 bg-white/10 p-2.5 shadow-2xl backdrop-blur-xl lg:p-5">
              <div
                className="mb-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 text-xs font-semibold tracking-wide uppercase"
                role="tablist"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isSignUp}
                  onClick={() => handleModeChange("signup")}
                  className={`flex-1 cursor-pointer rounded-2xl px-4 py-2 transition ${
                    isSignUp
                      ? "bg-white text-black shadow"
                      : "text-foreground/60 hover:text-foreground/80"
                  }`}
                >
                  {t("auth.tabs.signup")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isSignUp}
                  onClick={() => handleModeChange("signin")}
                  className={`flex-1 cursor-pointer rounded-2xl px-4 py-2 transition ${
                    isSignUp
                      ? "text-foreground/60 hover:text-foreground/80"
                      : "bg-white text-black shadow"
                  }`}
                >
                  {t("auth.tabs.signin")}
                </button>
              </div>

              <div className="mb-6 space-y-3">
                {activeCopy.kicker ? (
                  <p className="text-foreground/60 text-xs font-semibold tracking-wide uppercase">
                    {activeCopy.kicker}
                  </p>
                ) : null}
                <h2 className="text-3xl font-bold max-md:text-2xl">
                  {activeCopy.title}
                </h2>
                <p className="text-foreground/70 leading-relaxed">
                  {activeCopy.description}
                </p>
              </div>

              {isSignUp ? (
                <>
                  <form
                    className="flex flex-col gap-y-5"
                    onSubmit={handleSignUpSubmit}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-y-1 text-sm">
                        <span className="text-foreground/70">
                          {t("auth.fields.firstName")}{" "}
                          <span className="text-red-500">*</span>
                        </span>
                        <input
                          className={inputClass}
                          name="firstName"
                          type="text"
                          autoComplete="given-name"
                          placeholder={t("auth.placeholders.firstName")}
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-y-1 text-sm">
                        <span className="text-foreground/70">
                          {t("auth.fields.lastName")}{" "}
                          <span className="text-red-500">*</span>
                        </span>
                        <input
                          className={inputClass}
                          name="lastName"
                          type="text"
                          autoComplete="family-name"
                          placeholder={t("auth.placeholders.lastName")}
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-y-1 text-sm">
                        <span className="text-foreground/70">
                          {t("auth.fields.email")}{" "}
                          <span className="text-red-500">*</span>
                        </span>
                        <input
                          className={inputClass}
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder={t("auth.placeholders.email")}
                          required
                        />
                      </label>
                      <label className="flex flex-col gap-y-1 text-sm">
                        <span className="text-foreground/70">
                          {t("auth.fields.phone")}{" "}
                          <span className="text-red-500">*</span>
                        </span>
                        <input
                          className={inputClass}
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder={t("auth.placeholders.phone")}
                          required
                        />
                      </label>
                      <label className="col-span-2 flex flex-col gap-y-1 text-sm">
                        <span className="text-foreground/70">
                          {t("auth.fields.product")}{" "}
                          <span className="text-red-500">*</span>
                        </span>
                        <div className="relative">
                          <select
                            className={selectClass}
                            name="product"
                            value={selectedProduct}
                            onChange={handleProductChange}
                            required
                          >
                            <option value="" disabled>
                              {t("auth.placeholders.selectProduct")}
                            </option>
                            {productOptions.map((product) => (
                              <option key={product.value} value={product.value}>
                                {product.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="text-foreground/50 pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
                        </div>
                      </label>
                      <label className="col-span-2 flex flex-col gap-y-1 text-sm">
                        <span className="text-foreground/70">
                          {t("auth.fields.country")}{" "}
                          <span className="text-red-500">*</span>
                        </span>
                        <div className="space-y-2">
                          <div className="relative">
                            <input
                              className={inputClass}
                              name="countryName"
                              type="text"
                              value={countryQuery}
                              onChange={handleCountryInputChange}
                              onBlur={handleCountryBlur}
                              autoComplete="country-name"
                              placeholder={t("auth.placeholders.country")}
                              list={countryDatalistId}
                              required
                            />
                            <datalist id={countryDatalistId}>
                              {filteredCountries.slice(0, 50).map((country) => (
                                <option
                                  key={country.code}
                                  value={getCountryOptionLabel(country)}
                                />
                              ))}
                            </datalist>
                            <input
                              type="hidden"
                              name="country"
                              value={selectedCountry?.code ?? ""}
                            />
                          </div>
                          {countryError ? (
                            <p className="text-xs text-red-400">
                              {countryError}
                            </p>
                          ) : isLoadingCountries ? (
                            <p className="text-foreground/60 text-xs">
                              {t("auth.status.updatingCountries")}
                            </p>
                          ) : null}
                        </div>
                      </label>
                      <div
                        className={`col-span-2 grid gap-4 overflow-hidden transition-all duration-300 ease-out md:grid-cols-2 ${
                          selectedCountry
                            ? "max-h-[640px] translate-y-0 opacity-100"
                            : "pointer-events-none max-h-0 -translate-y-2 opacity-0"
                        }`}
                        aria-hidden={!selectedCountry}
                      >
                        <label className="col-span-2 flex flex-col gap-y-1 text-sm">
                          <span className="text-foreground/70">
                            {t("auth.fields.addressLine1")}{" "}
                            <span className="text-red-500">*</span>
                          </span>
                          <input
                            className={inputClass}
                            name="city"
                            type="text"
                            value={cityQuery}
                            onChange={(event) =>
                              setCityQuery(event.target.value)
                            }
                            autoComplete="address-line1"
                            placeholder={t("auth.placeholders.addressLine1")}
                            required={Boolean(selectedCountry)}
                            disabled={!selectedCountry}
                          />
                        </label>
                        <label className="flex flex-col gap-y-1 text-sm md:col-span-2">
                          <span className="text-foreground/70">
                            {t("auth.fields.addressLine2")}{" "}
                            <span className="text-red-500">*</span>
                          </span>
                          <input
                            className={inputClass}
                            name="addressLine1"
                            type="text"
                            autoComplete="address-line1"
                            placeholder={t("auth.placeholders.addressLine2")}
                            required={Boolean(selectedCountry)}
                            disabled={!selectedCountry}
                          />
                        </label>
                        <label className="flex flex-col gap-y-1 text-sm md:col-span-2">
                          <span className="text-foreground/70">
                            {t("auth.fields.addressLine3Optional")}
                          </span>
                          <input
                            className={inputClass}
                            name="addressLine2"
                            type="text"
                            autoComplete="address-line2"
                            placeholder={t("auth.placeholders.addressLine3")}
                            disabled={!selectedCountry}
                          />
                        </label>
                      </div>
                      <label className="col-span-2 flex flex-col gap-y-1 text-sm">
                        <span className="text-foreground/70">
                          {t("auth.fields.website")}
                        </span>
                        <input
                          className={inputClass}
                          name="website"
                          type="text"
                          autoComplete="website"
                          placeholder={t("auth.placeholders.website")}
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-y-1 text-sm">
                      <span className="text-foreground/70">
                        {t("auth.fields.message")}{" "}
                        <span className="text-red-500">*</span>
                      </span>
                      <textarea
                        className={`${inputClass} min-h-[140px] resize-none`}
                        name="message"
                        placeholder={t("auth.placeholders.message")}
                        required
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        className="group relative inline-flex h-11 w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-white text-sm font-bold text-black uppercase transition-all duration-300 ease-out will-change-transform hover:shadow-[inset_0_3px_12px_rgba(255,255,255,0.35),inset_0_-6px_20px_rgba(0,0,0,0.45)] focus-visible:ring-2 focus-visible:ring-[#0A84FF] focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.93] active:shadow-[inset_0_1px_6px_rgba(255,255,255,0.5),inset_0_-8px_22px_rgba(0,0,0,0.65)]"
                      >
                        <span className="relative">{activeCopy.cta}</span>
                      </button>
                      <p className="text-foreground/60 text-xs">
                        {t("auth.disclaimer")}
                      </p>
                    </div>
                  </form>

                  {signUpSuccess && (
                    <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400/70">
                      {signUpSuccess}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <form
                    className="flex flex-col gap-y-4"
                    onSubmit={handleSignInSubmit}
                  >
                    <label className="flex flex-col gap-y-1 text-sm">
                      <span className="text-foreground/70">
                        {t("auth.fields.workEmail")}
                      </span>
                      <input
                        type="email"
                        name="email"
                        required
                        placeholder={t("auth.placeholders.workEmail")}
                        className={inputClass}
                      />
                    </label>

                    <label className="relative flex flex-col gap-y-1 text-sm">
                      <span className="text-foreground/70">
                        {t("auth.fields.password")}
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        required
                        placeholder={t("auth.placeholders.password")}
                        className={`${inputClass} pr-24`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="text-foreground/50 hover:text-foreground absolute top-9.5 right-3 text-xs font-semibold tracking-wide uppercase transition duration-300"
                      >
                        {showPassword ? <EyeClosed /> : <Eye />}
                      </button>
                    </label>

                    <div className="text-foreground/70 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="remember"
                          className="text-foreground/50 h-4 w-4 rounded border border-white/20 bg-white/10 focus:ring-white/40"
                        />
                        {t("auth.fields.rememberMe")}
                      </label>
                      <button
                        type="button"
                        className="text-foreground/50 hover:text-foreground/70 font-medium transition-all duration-300"
                      >
                        {t("auth.actions.forgotPassword")}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={signInLoading}
                      className="group relative inline-flex h-11 w-full items-center justify-center overflow-hidden rounded-2xl bg-white text-sm font-bold text-black uppercase transition-all duration-300 ease-out will-change-transform hover:shadow-[inset_0_3px_12px_rgba(255,255,255,0.35),inset_0_-6px_20px_rgba(0,0,0,0.45)] focus-visible:ring-2 focus-visible:ring-[#0A84FF] focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.93] active:shadow-[inset_0_1px_6px_rgba(255,255,255,0.5),inset_0_-8px_22px_rgba(0,0,0,0.65)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <span className="relative">
                        {signInLoading
                          ? t("auth.signin.processing")
                          : activeCopy.cta}
                      </span>
                    </button>
                  </form>

                  {signInError && (
                    <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400/70">
                      {signInError}
                    </div>
                  )}
                  {signInSuccess && (
                    <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400/70">
                      {signInSuccess}
                    </div>
                  )}
                </>
              )}

              <div className="text-foreground/70 mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Fingerprint className="h-5 w-5" />
                  {t("auth.security.title")}
                </div>
                <p>
                  {t("auth.security.bodyPrefix")}{" "}
                  <Link
                    to={withLanguage("/terms-of-condition")}
                    className="hover:text-foreground/70 font-medium text-white transition duration-300"
                  >
                    {t("terms.title")}
                  </Link>
                  {t("auth.security.bodySuffix")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
