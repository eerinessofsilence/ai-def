// Adapted from React Bits: https://reactbits.dev/micro/glide-select
// License: ./ReactBits.LICENSE.md
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import "./GlideSelect.css";

type GlideSelectOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
  tag?: string;
};

type GlideSelectProps<Value extends string> = {
  options: GlideSelectOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  ariaLabel: string;
  ariaDescribedBy?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  invalid?: boolean;
};

type Phase = "closed" | "open" | "closing";
const ROW_HEIGHT = 44;
const ROW_GAP = 1;
const MENU_GAP = 6;
const POP_OUT = 120;

export default function GlideSelect<Value extends string>({ options, value, onChange, ariaLabel, ariaDescribedBy, id: controlId, disabled = false, className = "", triggerClassName = "", invalid }: GlideSelectProps<Value>) {
  const selected = options.findIndex((option) => option.value === value);
  const [phase, setPhase] = useState<Phase>("closed");
  const [active, setActive] = useState<number | null>(null);
  const [side, setSide] = useState<"top" | "bottom">("bottom");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const instant = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scrub = useRef<{ id: number; top: number } | null>(null);
  const id = useId();
  const step = ROW_HEIGHT + ROW_GAP;

  useLayoutEffect(() => {
    if (phase !== "open") return;
    const menu = menuRef.current;
    const root = rootRef.current;
    if (!menu || !root) return;
    const bounds = root.getBoundingClientRect();
    const needed = menu.offsetHeight + MENU_GAP;
    setSide(bounds.bottom + needed > window.innerHeight && bounds.top >= needed ? "top" : "bottom");
    menu.dataset.state = "closed";
    void menu.offsetHeight;
    menu.dataset.state = "open";
    const pill = pillRef.current;
    if (pill) {
      pill.style.transition = "none";
      pill.style.transform = `translateY(${Math.max(0, selected) * step}px)`;
      pill.style.opacity = "0";
      void pill.offsetHeight;
      pill.style.transition = "";
    }
    // Only initialize the opening animation when the phase changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill || phase !== "open") return;
    if (active === null) {
      pill.style.opacity = "0";
      return;
    }
    const jump = instant.current || pill.style.opacity !== "1";
    pill.style.transitionDuration = jump ? "0ms, var(--cms-fast, 150ms)" : "";
    pill.style.transform = `translateY(${active * step}px)`;
    pill.style.opacity = "1";
    instant.current = false;
  }, [active, phase, step]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (phase !== "open" || active === null || !menu || scrub.current) return;
    const top = active * step + 4;
    if (top < menu.scrollTop) menu.scrollTop = top;
    else if (top + ROW_HEIGHT > menu.scrollTop + menu.clientHeight) menu.scrollTop = top + ROW_HEIGHT - menu.clientHeight;
  }, [active, phase, step]);

  const open = () => {
    if (disabled || triggerRef.current?.matches(":disabled") || options.length === 0) return;
    clearTimeout(closeTimer.current);
    instant.current = true;
    setActive(Math.max(0, selected));
    setPhase("open");
  };

  const close = (mode: "instant" | "pop") => {
    setActive(null);
    scrub.current = null;
    clearTimeout(closeTimer.current);
    const menu = menuRef.current;
    if (mode === "instant" || !menu || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("closed");
      return;
    }
    menu.dataset.state = "closed";
    setPhase("closing");
    closeTimer.current = setTimeout(() => setPhase("closed"), POP_OUT + 20);
  };

  const pick = (index: number, viaKey: boolean) => {
    const option = options[index];
    if (disabled || triggerRef.current?.matches(":disabled") || !option || option.disabled) return;
    if (option.value !== value) {
      onChange(option.value);
      if (!viaKey && rootRef.current) rootRef.current.dataset.swap = "";
    }
    close("instant");
    triggerRef.current?.focus({ preventScroll: true });
  };

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key;
    const current = active ?? Math.max(0, selected);
    if (phase !== "open") {
      if (key === "Enter" || key === " " || key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        open();
      }
      return;
    }
    const go = (index: number) => {
      event.preventDefault();
      instant.current = true;
      setActive(Math.min(options.length - 1, Math.max(0, index)));
    };
    if (key === "ArrowDown" || key === "ArrowUp") go(current + (key === "ArrowDown" ? 1 : -1));
    else if (key === "Home" || key === "End") go(key === "Home" ? 0 : options.length - 1);
    else if (key === "Enter" || key === " ") {
      event.preventDefault();
      pick(current, true);
    } else if (key === "Escape" || key === "Tab") {
      if (key === "Escape") event.preventDefault();
      close("instant");
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      for (let offset = 1; offset <= options.length; offset++) {
        const index = (current + offset) % options.length;
        if (options[index].label.toLocaleLowerCase().startsWith(key.toLocaleLowerCase())) {
          go(index);
          break;
        }
      }
    }
  };

  useEffect(() => {
    if (phase === "closed") return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close("pop");
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => { if (disabled) close("instant"); }, [disabled]);

  const rowAt = (y: number) => {
    if (!scrub.current) return null;
    const index = Math.floor((y - scrub.current.top) / step);
    return index >= 0 && index < options.length ? index : null;
  };
  const onListDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || event.button !== 0 || scrub.current || phase !== "open") return;
    triggerRef.current?.focus({ preventScroll: true });
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrub.current = { id: event.pointerId, top: event.currentTarget.getBoundingClientRect().top };
    instant.current = true;
    setActive(rowAt(event.clientY));
  };
  const onListMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrub.current || scrub.current.id !== event.pointerId) return;
    setActive(rowAt(event.clientY));
  };
  const onListUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!scrub.current || scrub.current.id !== event.pointerId) return;
    const index = event.type === "pointerup" ? rowAt(event.clientY) : null;
    scrub.current = null;
    if (index !== null) pick(index, false);
    else setActive(Math.max(0, selected));
  };
  const onListOver = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || scrub.current || phase !== "open") return;
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (row) setActive(Number(row.dataset.index));
  };
  const currentOption = options[selected];

  return (
    <div
      ref={rootRef}
      className={`store-glide-select ${className}`}
      style={{ "--gs-row": `${ROW_HEIGHT}px`, "--gs-origin": `${side === "bottom" ? "top" : "bottom"} right` } as CSSProperties}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close("instant");
      }}
      onAnimationEnd={(event) => {
        if (event.animationName === "gs-swap" && rootRef.current) delete rootRef.current.dataset.swap;
      }}
    >
      <button
        ref={triggerRef}
        id={controlId}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={phase === "open"}
        aria-controls={phase !== "closed" ? `${id}-list` : undefined}
        aria-activedescendant={phase === "open" && active !== null ? `${id}-${active}` : undefined}
        aria-label={`${ariaLabel}: ${currentOption?.label ?? ""}${currentOption?.tag ? ` · ${currentOption.tag}` : ""}`}
        disabled={disabled || options.length === 0}
        className={`store-glide-select__trigger ${triggerClassName}`}
        onClick={() => {
          if (phase === "open") close("pop");
          else open();
        }}
        onKeyDown={onTriggerKey}
      >
        <span className="store-glide-select__label" key={value}>
          <span className="store-glide-select__name">{currentOption?.label}</span>
          {currentOption?.tag && <span className="store-glide-select__tag">· {currentOption.tag}</span>}
        </span>
        <ChevronDown size={16} strokeWidth={2} className="store-glide-select__chevron" aria-hidden="true" />
      </button>
      {phase !== "closed" ? (
        <div ref={menuRef} className="store-glide-select__menu" data-state="open" data-side={side} aria-hidden={phase === "closing"}>
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label={ariaLabel}
            className="store-glide-select__list"
            data-live={active !== null ? "" : undefined}
            onClick={(event) => event.preventDefault()}
            onMouseDown={(event) => event.preventDefault()}
            onPointerOver={onListOver}
            onPointerDown={onListDown}
            onPointerMove={onListMove}
            onPointerUp={onListUp}
            onPointerCancel={onListUp}
            onLostPointerCapture={onListUp}
          >
            <span ref={pillRef} className="store-glide-select__pill" aria-hidden="true" />
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === selected}
                aria-disabled={option.disabled || undefined}
                data-index={index}
                className="store-glide-select__option"
                onClick={(event) => {
                  event.preventDefault();
                  if (phase === "open") pick(index, false);
                }}
              >
                <span className="store-glide-select__name">{option.label}</span>
                <span className="store-glide-select__tag">{option.tag}</span>
                <Check size={15} strokeWidth={2.5} className="store-glide-select__check" data-on={index === selected ? "" : undefined} aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
