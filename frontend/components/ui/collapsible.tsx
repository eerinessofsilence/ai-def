import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import "./form-controls.css";

export default function Collapsible({ title, children, className, defaultOpen = false, actions, invalid = false }: { title: ReactNode; children: ReactNode; className?: string; defaultOpen?: boolean; actions?: ReactNode; invalid?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLElement>(null);
  const id = useId();
  useEffect(() => {
    const element = root.current;
    const expand = () => setOpen(true);
    element?.addEventListener("cms-expand", expand);
    return () => element?.removeEventListener("cms-expand", expand);
  }, []);
  return <section ref={root} className={className} data-cms-collapse>
    <div className="ui-collapse-heading"><button type="button" className="ui-collapse-trigger" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span>{title}{invalid && <small className="cms-collapse-error">Needs attention</small>}</span><ChevronDown aria-hidden="true" />
    </button>{actions}</div>
    <div id={id} className="ui-collapse-panel" data-open={open} inert={!open} aria-hidden={!open}>
      <div><div className="ui-collapse-content">{children}</div></div>
    </div>
  </section>;
}
