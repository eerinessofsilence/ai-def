import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, CircleAlert, Inbox, RefreshCw, WifiOff, X, Check, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { isCurrentPreview } from "./changes";

// Shared by validation links and the controls rendered in this module.
// eslint-disable-next-line react-refresh/only-export-components
export function focusField(path: string, attempt = 0) {
  let target: HTMLElement | null | undefined = document.getElementById(path) || Array.from(document.querySelectorAll<HTMLElement>("[data-field-path]")).find((element) => {
    const field = element.dataset.fieldPath!;
    return field === path || field.startsWith(path + ".") || path.startsWith(field + ".");
  });
  for (let parentPath = path; !target && parentPath.includes(".");) {
    parentPath = parentPath.slice(0, parentPath.lastIndexOf("."));
    target = document.getElementById(parentPath);
  }
  if (!target) {
    if (attempt < 30) requestAnimationFrame(() => focusField(path, attempt + 1));
    return;
  }
  for (let parent: HTMLElement | null = target; parent; parent = parent.parentElement) {
    if (parent.hasAttribute("data-cms-collapse")) parent.dispatchEvent(new Event("cms-expand"));
  }
  const field = target;
  requestAnimationFrame(() => {
    const control = field.matches("input,textarea,button,[contenteditable=true]") ? field : field.querySelector<HTMLElement>('[data-translation-missing="true"]:not(:disabled)') || field.querySelector<HTMLElement>("input:not(:disabled),textarea:not(:disabled),[contenteditable=true]") || field.querySelector<HTMLElement>("button:not(:disabled)") || field;
    // Route transitions and collapsed sections can commit after the error link's click.
    if (!control.getClientRects().length || control.closest("[inert]")) {
      if (attempt < 30) focusField(path, attempt + 1);
      return;
    }
    control.focus({ preventScroll: true });
    control.scrollIntoView({ block: "center" });
  });
}

export function Modal({ open, onClose, title, description, children, wide = false, preventDismiss = false, className = "" }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; wide?: boolean; preventDismiss?: boolean; className?: string;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const pageFocus = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && className !== "cms-preview-modal") window.dispatchEvent(new Event("cms-modal-open"));
  }, [open, className]);
  useEffect(() => {
    if (open) return;
    const remember = () => {
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body && !panel.current?.contains(document.activeElement)) {
        returnFocus.current = document.activeElement;
        if (!document.activeElement.closest('[role="dialog"]')) pageFocus.current = document.activeElement;
      }
    };
    remember();
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, [open]);
  return <Dialog.Root open={open} onOpenChange={(value) => { if (!value && !preventDismiss) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="cms-overlay" /><Dialog.Content ref={panel} className={`cms-modal${wide ? " cms-modal-wide" : ""} ${className}`} onCloseAutoFocus={(event) => { const target = returnFocus.current?.isConnected ? returnFocus.current : pageFocus.current; if (target?.isConnected) { event.preventDefault(); target.focus({ preventScroll: true }); } else if (document.activeElement && document.activeElement !== document.body && document.activeElement.isConnected) event.preventDefault(); }} onEscapeKeyDown={(event) => { if (preventDismiss) event.preventDefault(); }} onPointerDownOutside={(event) => { if (preventDismiss) event.preventDefault(); }}>
      <header><Dialog.Title>{title}</Dialog.Title><Dialog.Close className="cms-icon" aria-label="Close" disabled={preventDismiss}><X /></Dialog.Close></header>
      <Dialog.Description className={description ? "cms-muted" : "cms-sr"}>{description || title}</Dialog.Description>
      {children}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

export function ErrorMessage({ message, retry, fields = {} }: { message: string; retry?: () => void; fields?: Record<string, string> }) {
  return <div className="cms-error" role="alert"><div className="cms-error-content"><CircleAlert aria-hidden="true" /><p>{message}</p></div>{Object.keys(fields).length > 0 && <ul>{Object.entries(fields).map(([key, value]) => <li key={key}>{key.replace(/_/g, " ")}: {value}</li>)}</ul>}{retry && <button type="button" className="cms-button" onClick={retry}><RefreshCw aria-hidden="true" />Try again</button>}</div>;
}

export function ConnectionState({ error, retry }: { error: string; retry: () => void }) {
  return <main className="cms-login cms-connection"><section className="cms-login-card cms-connection-card" aria-labelledby="cms-connection-title">
    <img className="cms-login-logo" src="/logo-ai-def.svg" alt="AI DEF" width="160" height="44" />
    {error && <span className="cms-connection-icon"><WifiOff aria-hidden="true" /></span>}
    <h1 id="cms-connection-title">{error ? "Unable to open CMS" : "Connecting to CMS"}</h1>
    {error ? <><p className="cms-muted" role="alert">{error}</p><button type="button" className="cms-button cms-primary" onClick={retry}><RefreshCw aria-hidden="true" />Try again</button><p className="cms-connection-help cms-muted">If the problem continues, contact your site administrator.</p></> : <Loading label="Checking your session…" />}
  </section></main>;
}

export function SaveState({ state, uploading = 0, context }: { state: "loading" | "saved" | "dirty" | "saving" | "error"; uploading?: number; context?: string }) {
  const label = uploading ? "Uploading…" : { loading: "Loading…", saved: "Saved to CMS", dirty: "Unsaved changes", saving: "Saving…", error: "Save failed" }[state];
  return <span className="cms-save-state" data-state={uploading ? "uploading" : state} role="status" title={`${context ? context + ". " : ""}Saving to CMS does not publish changes to the website.`}>{context && <span className="cms-save-scope">{context}</span>}<span className="cms-save-label" key={uploading ? "uploading" : state}>{state === "saved" && !uploading && <Check aria-hidden="true" />}{label}</span></span>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="cms-loading" role="status"><span className="cms-spinner" />{label}</div>;
}

export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="cms-empty"><Inbox className="cms-empty-icon" aria-hidden="true" /><h2>{title}</h2><p className="cms-muted">{description}</p>{children}</div>;
}

export function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (value: number) => void }) {
  if (pages <= 1) return null;
  return <footer className="cms-pagination"><span className="cms-muted">{total ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, total)} of ${total}` : "0 results"}</span><div><span className="cms-muted">Page {page} of {pages}</span><button type="button" className="cms-icon" disabled={page <= 1} aria-label="Previous page" onClick={() => onPage(page - 1)}><ChevronLeft /></button><button type="button" className="cms-icon" disabled={page >= pages} aria-label="Next page" onClick={() => onPage(page + 1)}><ChevronRight /></button></div></footer>;
}

export function MoreActions({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) root.current.open = false; };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);
  return <details className="cms-more" ref={root} onKeyDown={(event) => { if (event.key === "Escape" && root.current) { root.current.open = false; root.current.querySelector("summary")?.focus(); } }}><summary role="button" className="cms-icon" aria-label="More actions" title="More actions"><MoreHorizontal aria-hidden="true" /></summary><div className="cms-dropdown" onClick={(event) => { if ((event.target as Element).closest("button") && root.current) { root.current.open = false; root.current.querySelector("summary")?.focus(); } }}>{children}</div></details>;
}

export function RemoveButton({ label, onRemove, disabled = false, icon = false }: { label: string; onRemove: () => void; disabled?: boolean; icon?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={icon ? "cms-icon cms-danger" : "cms-button cms-danger"} disabled={disabled} aria-label={`Remove ${label}`} onClick={() => setOpen(true)}>{icon ? <Trash2 /> : "Remove from draft"}</button><Modal open={open} onClose={() => setOpen(false)} title={`Remove ${label}?`} description="This removes the item from the draft. The published website changes only after publication. You can restore an earlier draft from version history."><footer><button type="button" className="cms-button" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="cms-button cms-danger" disabled={disabled} onClick={() => { onRemove(); setOpen(false); }}>Remove from draft</button></footer></Modal></>;
}

export function RestoreButton({ version, disabled, onRestore }: { version: number; disabled: boolean; onRestore: () => void }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="cms-button" disabled={disabled} onClick={() => setOpen(true)}>Restore as draft</button><Modal open={open} onClose={() => setOpen(false)} title={`Restore version ${version}?`} description="Your current work will first be saved to history. The selected version replaces the draft; the published website stays unchanged until you publish."><footer><button type="button" className="cms-button" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="cms-button cms-primary" disabled={disabled} onClick={() => { setOpen(false); onRestore(); }}>Restore as draft</button></footer></Modal></>;
}

export function PreviewSurface({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode }) {
  const [docked, setDocked] = useState(() => window.matchMedia("(min-width:1600px)").matches);
  const trigger = useRef<HTMLElement | null>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const hide = () => close.current();
    window.addEventListener("cms-modal-open", hide);
    return () => window.removeEventListener("cms-modal-open", hide);
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(min-width:1600px)");
    const update = () => setDocked(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (open) trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);
  if (!docked) return <Modal open={open} onClose={onClose} title={title} description={description} className="cms-preview-modal" wide>{children}</Modal>;
  return open ? <aside className="cms-preview-dock" aria-label={title}><header><h2>{title}</h2><button type="button" className="cms-icon" aria-label="Close preview" onClick={() => { onClose(); trigger.current?.focus({ preventScroll: true }); }}><X /></button></header>{description && <p className="cms-muted">{description}</p>}{children}</aside> : null;
}

export function PreviewFrame({ src, title, mobile, onField, focusPath, refresh, currentVersion, unsaved = false }: { src: string; title: string; mobile: boolean; onField?: (path: string) => void; focusPath?: string; refresh?: () => Promise<unknown>; currentVersion?: number; unsaved?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [inspect, setInspect] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const targetWidth = mobile ? 390 : 1440;
  const scale = Math.min(1, (size.width || targetWidth) / targetWidth);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const frame = useRef<HTMLIFrameElement>(null);
  const url = new URL(src, window.location.origin);
  if (inspect) url.searchParams.set("inspect", "1");
  if (focusPath) url.searchParams.set("focus", focusPath);
  useEffect(() => {
    if (!onField || !inspect) return;
    const select = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== "cms-preview-field" || typeof event.data.path !== "string" || event.data.path.length >= 600) return;
      if (!isCurrentPreview(event.data.version, currentVersion, unsaved)) { setRefreshError("This preview no longer matches the open draft. Refresh before selecting a field. If another editor changed the draft, open the latest version."); return; }
      onField(event.data.path);
    };
    window.addEventListener("message", select);
    return () => window.removeEventListener("message", select);
  }, [onField, inspect, currentVersion, unsaved]);
  useEffect(() => { setLoaded(false); setFailed(false); }, [src, attempt]);
  return <>{onField && <div className="cms-preview-tools"><p className="cms-muted">{inspect ? "Click highlighted text or an image to edit. Repeated copy and fixed layout elements may not be selectable." : `Saved snapshot · ${targetWidth}px ${mobile ? "phone" : "desktop"} viewport. Refresh after editing. Inspect connects content to its field.`}</p><div>{refresh && <button type="button" className="cms-button" disabled={refreshing} onClick={() => { setRefreshing(true); setRefreshError(""); void refresh().then(() => { setLoaded(false); setAttempt((value) => value + 1); }).catch((error: unknown) => setRefreshError(error instanceof Error ? error.message : "Unable to refresh preview.")).finally(() => setRefreshing(false)); }}><RefreshCw aria-hidden="true" />{refreshing ? "Refreshing…" : "Refresh"}</button>}<button type="button" className="cms-button" aria-pressed={inspect} onClick={() => { setLoaded(false); setInspect((value) => !value); }}>Inspect fields</button></div></div>}{refreshError && <ErrorMessage message={refreshError} />}<div ref={container} className={`cms-preview-frame${mobile ? " is-mobile" : ""}`}>
    {!loaded && !failed && <div className="cms-preview-loading"><Loading label="Opening preview…" /></div>}
    {failed ? <ErrorMessage message="Unable to open preview." retry={() => setAttempt((value) => value + 1)} /> : <iframe ref={frame} style={{ position: "absolute", top: 0, left: Math.max(0, (size.width - targetWidth * scale) / 2), width: targetWidth, height: (size.height || 180) / scale, transform: `scale(${scale})`, transformOrigin: "top left" }} key={`${url.href}:${attempt}`} title={title} src={url.href} onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(true); }} />}
  </div></>;
}
