import { useState } from "react";
import type { ReactNode } from "react";
import { hasTranslation, plainText } from "./translations";
import { Modal } from "./ui";

function Original({ value }: { value: unknown }) {
  if (typeof value === "string") return <p className="cms-original-text">{plainText(value) || "Not filled in"}</p>;
  if (Array.isArray(value)) return <ol className="cms-original-list">{value.map((item, index) => <li key={index}><Original value={item} /></li>)}</ol>;
  if (value && typeof value === "object") return <div className="cms-original-values">{Object.entries(value).map(([key, item]) => <Original key={key} value={item} />)}</div>;
  return <p className="cms-muted">Not filled in</p>;
}

export default function TranslationField({ compare, original, value, onCopy, children, label }: { compare: boolean; original: unknown; value: unknown; onCopy: () => void; children: ReactNode; label: string }) {
  const [confirm, setConfirm] = useState(false);
  return <div className={`cms-translation-field${compare ? " is-comparing" : ""}`}>
    {compare && <aside className="cms-original"><strong>Original · EN</strong><Original value={original} />{hasTranslation(original) && <button type="button" className="cms-button" onClick={() => { if (hasTranslation(value)) setConfirm(true); else onCopy(); }}>Copy EN</button>}</aside>}
    <div className="cms-translation-input">{children}</div>
    <Modal open={confirm} onClose={() => setConfirm(false)} title="Replace existing translation?" description={`«${label}”: this draft field will be replaced with the English original. Other fields and languages will be preserved.`}><footer><button type="button" className="cms-button" onClick={() => setConfirm(false)}>Cancel</button><button type="button" className="cms-button cms-primary" onClick={() => { onCopy(); setConfirm(false); }}>Replace translation</button></footer></Modal>
  </div>;
}
