import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { languages } from "./api";

export function useEditorNavigation(site: string, initialSection: string, ready: boolean) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("lang") || "en";
  const language = languages.some(([code]) => code === requested && (site === "arms" || code !== "ru")) ? requested : "en";
  const section = params.get("section") || initialSection;
  useEffect(() => {
    if (ready) document.querySelector<HTMLElement>(".cms-editor h1")?.focus({ preventScroll: true });
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    const reveal = () => {
      const tab = document.querySelector<HTMLElement>('.cms-section-nav > [aria-current="page"]');
      const nav = tab?.parentElement;
      if (!tab || !nav || nav.scrollWidth <= nav.clientWidth) return;
      const offset = tab.getBoundingClientRect().left - nav.getBoundingClientRect().left;
      if (offset >= 0 && offset + tab.offsetWidth <= nav.clientWidth) return;
      nav.scrollLeft += offset < 0 ? offset : offset + tab.offsetWidth - nav.clientWidth;
    };
    reveal();
    window.addEventListener("resize", reveal);
    return () => window.removeEventListener("resize", reveal);
  }, [ready, section]);
  function update(key: string, value: string) {
    setParams((previous) => { const next = new URLSearchParams(previous); next.set(key, value); return next; }, { replace: true });
  }
  return { language, setLanguage: (value: string) => update("lang", value), section, setSection: (value: string) => update("section", value) };
}
