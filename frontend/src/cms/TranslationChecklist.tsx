import { useRef } from "react";
import type { ReactNode } from "react";
import type { MissingTranslation } from "./translations";

export default function TranslationChecklist({ language, tasks, onField, children }: { language: string; tasks: MissingTranslation[]; onField: (path: string) => void; children?: ReactNode }) {
  const previous = useRef("");
  if (language === "en") return null;
  return <section className="cms-translation-checklist" aria-label="Translation checklist">{(tasks.length > 0 || !children) && <><div className="cms-panel-heading"><div><strong>{tasks.length ? `${tasks.length} incomplete translated ${tasks.length === 1 ? "field" : "fields"}` : "No missing translations relative to English"}</strong></div>{tasks.length > 0 && <button type="button" className="cms-button" onClick={() => {
    const index = tasks.findIndex((task) => task.path === previous.current);
    const next = tasks[(index + 1) % tasks.length]; previous.current = next.path; onField(next.path);
  }}>Next missing field</button>}</div>{tasks.length > 0 && <details><summary>Show missing fields</summary><ul>{tasks.map((task) => <li key={task.path}><button type="button" onClick={() => { previous.current = task.path; onField(task.path); }}><span>{task.label}</span><small>{task.missing} empty {task.missing === 1 ? "value" : "values"}</small></button></li>)}</ul></details>}</>}{children}</section>;
}
