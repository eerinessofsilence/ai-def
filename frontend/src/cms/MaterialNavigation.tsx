import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "./api";
import type { CMSDocument, ProductList } from "./api";
import { materialNeighbors } from "./material-navigation";
import type { MaterialNeighbor } from "./material-navigation";

export default function MaterialNavigation({ document, language, prepare, onError, disabled }: {
  document: CMSDocument<unknown>; language: string; prepare: () => Promise<unknown>; onError: (error: unknown) => void; disabled: boolean;
}) {
  const [params] = useSearchParams();
  const from = params.get("from");
  const navigate = useNavigate();
  const [neighbors, setNeighbors] = useState<Awaited<ReturnType<typeof materialNeighbors>> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const { id, target_id, site, kind } = document;
  useEffect(() => {
    if (from === null) return;
    const abort = new AbortController();
    const query = new URLSearchParams(from);
    setNeighbors(null); setError("");
    const load = (page: number) => { const request = new URLSearchParams(query); request.set("page", String(page)); return api<ProductList>(`${site}/${kind}/?${request}`, { signal: abort.signal }); };
    void materialNeighbors({ id, target_id }, Math.max(1, Number(query.get("page")) || 1), load).then((value) => { if (!abort.signal.aborted) setNeighbors(value); }).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load adjacent materials."); });
    return () => abort.abort();
  }, [id, target_id, site, kind, from, attempt]);
  async function open(neighbor: MaterialNeighbor) {
    setBusy(true);
    try {
      await prepare();
      const selection = new URLSearchParams(from || ""); selection.set("page", String(neighbor.page));
      await navigate(`/${site}/${kind}/${neighbor.row.document_id || `live-${neighbor.row.target_id}`}?${new URLSearchParams({ from: selection.toString(), lang: language })}`);
    } catch (failure) { onError(failure); }
    finally { setBusy(false); }
  }
  if (from === null) return null;
  return <nav className="cms-material-navigation" aria-label="Materials in current results"><span className="cms-muted" role="status">{error || (neighbors ? neighbors.found ? "Current results" : "This material no longer matches the current results. Return to the list to update your selection." : "Loading current results…")}</span>{error ? <button className="cms-button" onClick={() => setAttempt((value) => value + 1)}>Retry</button> : <div className="cms-row-actions">{([[-1, neighbors?.previous], [1, neighbors?.next]] as const).map(([direction, neighbor]) => <button key={direction} className="cms-button" disabled={disabled || busy || !neighbor} title={neighbor?.row.name} aria-label={`${direction < 0 ? "Previous" : "Next"} material${neighbor ? `: ${neighbor.row.name}` : ""}`} onClick={() => { if (neighbor) void open(neighbor); }}>{direction < 0 && <ArrowLeft />}{direction < 0 ? "Previous" : "Next"}{direction > 0 && <ArrowRight />}</button>)}</div>}</nav>;
}
