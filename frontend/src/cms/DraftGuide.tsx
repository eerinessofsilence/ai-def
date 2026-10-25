import Collapsible from "../../components/ui/collapsible";

export default function DraftGuide({ kind, section, onSection, onReview }: { kind: string; section: string; onSection: (section: string) => void; onReview?: () => void }) {
  const steps = kind === "articles" ? [["blocks", "Write the article"], ["photos", "Choose a cover"]]
    : kind === "arms" ? [["main", "Add product information"], ["photos", "Choose a cover"], ["variants", "Prepare variants and photos"]]
    : [["main", "Add the main information"], ["photos", "Choose images"]];
  return <Collapsible className="cms-draft-guide" defaultOpen title="Prepare your new draft"><p className="cms-muted">Work in any order. Changes are saved to CMS; the website updates only after publication.</p><ol>{steps.map(([key, label]) => <li key={key}><button type="button" className="cms-button" aria-current={section === key ? "step" : undefined} onClick={() => onSection(key)}>{label}</button></li>)}{onReview && <li><button type="button" className="cms-button" onClick={onReview}>Review before publishing</button></li>}</ol></Collapsible>;
}
