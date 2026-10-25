import { Columns2, Languages } from "lucide-react";
import Select from "../../components/ui/select";
import { languages } from "./api";
import type { Coverage } from "./translations";
import type { TranslationReviewStatus } from "./api";
import { coverageLabel, reviewLabel } from "./translations";

type Props = { site: string; language: string; onLanguage: (value: string) => void; compare: boolean; onCompare: (value: boolean) => void; coverage: (language: string) => Coverage };

export default function LanguageBar({ site, language, onLanguage, compare, onCompare, coverage }: Props) {
  const progress = coverage(language);
  const description = coverageLabel(progress);
  return <div className="cms-language"><Languages aria-hidden="true" /><label htmlFor="editor-language"><span className="cms-language-label-long">Content </span>language</label><Select id="editor-language" value={language} onValueChange={onLanguage}>{languages.filter(([code]) => site === "arms" || code !== "ru").map(([code, name]) => <option key={code} value={code}>{name}</option>)}</Select>{language !== "en" && <button type="button" className="cms-button" aria-pressed={compare} onClick={() => onCompare(!compare)}><Columns2 aria-hidden="true" /><span className="cms-compare-label-long">Compare with </span>EN</button>}<span className="cms-muted cms-coverage-label" aria-label={description} title={description}>{progress.filled}/{progress.total}<span className="cms-coverage-detail"> · {progress.total ? description.split(" · ")[1] : "no translatable fields"}</span></span></div>;
}

export function TranslationSummary({ site, coverage, onLanguage, reviews, unsaved = false }: { site: string; coverage: (language: string) => Coverage; onLanguage: (value: string) => void; reviews?: Record<string, TranslationReviewStatus>; unsaved?: boolean }) {
  return <details className="cms-translation-summary"><summary>Translations</summary><p className="cms-muted">Completion tracks filled fields; review records a manual check. Missing translations use English.</p>{languages.filter(([code]) => site === "arms" || code !== "ru").map(([code, label]) => <button key={code} type="button" onClick={() => onLanguage(code)}><span>{label}</span><small>{coverageLabel(coverage(code))}</small>{code !== "en" && <small>{reviewLabel(reviews?.[code], unsaved)}</small>}</button>)}</details>;
}
