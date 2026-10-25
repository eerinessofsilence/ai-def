import { lazy, Suspense, useState } from "react";
import { Images } from "lucide-react";
import type { MediaAsset, MediaKind } from "./api";
import { Loading, Modal } from "./ui";

const MediaBrowser = lazy(() => import("./MediaLibrary").then((module) => ({ default: module.MediaBrowser })));

export default function MediaPicker({ site, kind = "image", multiple = false, onChoose, trackUpload, currentURL, context, label = "Choose or upload a file" }: {
  site: string; kind?: MediaKind; multiple?: boolean; onChoose: (assets: MediaAsset[]) => void;
  trackUpload?: (task: Promise<void>) => void; currentURL?: string; label?: string; context?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MediaAsset[]>([]);
  const [busy, setBusy] = useState(false);
  return <><button type="button" className="cms-button" onClick={() => { setSelected([]); setOpen(true); }}><Images aria-hidden="true" />{label}</button>
    <Modal open={open} onClose={() => setOpen(false)} preventDismiss={busy} title={context || "Choose file"} description={multiple ? "Select files in the order they should be added to the content." : "Choose one file. The content changes after confirmation."} wide>
      {currentURL && <p className="cms-muted">Current content file: <a href={currentURL} target="_blank" rel="noreferrer">open</a>. Cancelling will keep it selected.</p>}
      <Suspense fallback={<Loading label="Opening media library…" />}><MediaBrowser site={site} kind={kind} multiple={multiple} selected={selected} trackUpload={trackUpload} onBusyChange={setBusy} onSelect={(asset) => setSelected((previous) => {
        if (previous.some((item) => item.ref.asset_id === asset.ref.asset_id)) return previous.filter((item) => item.ref.asset_id !== asset.ref.asset_id);
        return multiple ? [...previous, asset] : [asset];
      })} /></Suspense>
      <footer className="cms-picker-footer"><span className="cms-muted">Selected: {selected.length}{busy ? " · uploading…" : ""}</span><button type="button" className="cms-button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button type="button" className="cms-button cms-primary" disabled={busy || !selected.length} onClick={() => { onChoose(selected); setOpen(false); }}>{multiple ? `Add files · ${selected.length}` : "Use file"}</button></footer>
    </Modal></>;
}
