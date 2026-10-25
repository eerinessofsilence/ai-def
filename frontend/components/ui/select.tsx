import { Children, Fragment, isValidElement, useEffect, useId, useState, type ReactNode } from "react";
import GlideSelect from "../store/GlideSelect";
import "./form-controls.css";

type Option = { value: string; label: string; disabled?: boolean };
type Props = {
  id?: string; value?: string | number; onValueChange: (value: string) => void;
  children: ReactNode; name?: string; required?: boolean; disabled?: boolean;
  className?: string; "aria-label"?: string; tone?: "dark" | "light";
  "aria-invalid"?: boolean; "aria-describedby"?: string;
};

export default function Select({ id, value = "", onValueChange, children, name, required, disabled, className, "aria-label": ariaLabel, "aria-invalid": externalInvalid, "aria-describedby": describedBy, tone = "dark" }: Props) {
  const generatedId = useId();
  const controlId = id || generatedId;
  const [label, setLabel] = useState(ariaLabel || "");
  const [invalid, setInvalid] = useState(false);
  const options: Option[] = [];
  function collect(nodes: ReactNode) {
    Children.forEach(nodes, (node) => {
      if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(node)) return;
      if (node.type === Fragment) collect(node.props.children);
      else if (node.type === "option") options.push({
        value: String(node.props.value ?? ""),
        label: Children.toArray(node.props.children).join(""),
        disabled: node.props.disabled,
      });
    });
  }
  collect(children);
  useEffect(() => {
    const button = document.getElementById(controlId) as HTMLButtonElement | null;
    const parentLabel = button?.labels?.[0]?.cloneNode(true) as HTMLElement | undefined;
    parentLabel?.querySelectorAll(".ui-select").forEach((element) => element.remove());
    setLabel(ariaLabel || parentLabel?.textContent?.trim() || "");
  }, [ariaLabel, controlId, children]);
  return <div className="ui-select" data-tone={tone}>
    <GlideSelect id={controlId} options={options} value={String(value)} onChange={(selected) => {
      setInvalid(false); onValueChange(selected);
    }} ariaLabel={label} ariaDescribedBy={describedBy} disabled={disabled} invalid={invalid || externalInvalid} triggerClassName={className} />
    {(name || required) && <input name={name} type={required ? "text" : "hidden"} value={value} disabled={disabled} required={required} tabIndex={-1} aria-hidden="true"
      style={{ position: "absolute", opacity: 0, width: 1, height: 1, minHeight: 0, padding: 0, border: 0, pointerEvents: "none" }}
      onChange={() => undefined} onInvalid={(event) => { event.preventDefault(); setInvalid(true); document.getElementById(controlId)?.focus(); }} />}
    {invalid && <span className="ui-select-error" role="alert">{options.find((option) => option.value === "")?.label || label}</span>}
  </div>;
}
