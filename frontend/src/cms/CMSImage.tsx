import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

export default function CMSImage({ src, alt = "", compact = false, className }: { src: string; alt?: string; compact?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return failed ? <span className={`cms-media-fallback${compact ? " is-compact" : ""}`}><ImageOff aria-hidden="true" />{!compact && <span>Image unavailable. You can upload a replacement.</span>}</span> : <img src={src} alt={alt} loading="lazy" className={className} onError={() => setFailed(true)} />;
}
