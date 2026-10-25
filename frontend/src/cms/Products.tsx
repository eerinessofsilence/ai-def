import Select from "../../components/ui/select";
import { useEffect, useRef, useState } from "react";
import { ImageOff, Plus, Search } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, APIError, categories, dateTime, mediaURL, statuses } from "./api";
import type { CMSDocument, ProductList } from "./api";
import { EmptyState, ErrorMessage, Loading, Modal, Pagination } from "./ui";
import { collectionNames } from "./content-types";
import { useSession } from "./session";
import CMSImage from "./CMSImage";
import WebsiteOrder from "./WebsiteOrder";

export default function Products() {
  const { site = "arms", kind = "products" } = useParams();
  return <MaterialList key={`${site}:${kind}`} site={site} kind={kind} />;
}

function MaterialList({ site, kind }: { site: string; kind: string }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const queryString = params.toString();
  const [search, setSearch] = useState(params.get("q") || "");
  const [list, setList] = useState<ProductList | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [creationError, setCreationError] = useState("");
  const [creationFields, setCreationFields] = useState<Record<string, string>>({});
  const ordering = params.get("ordering") === "1";
  const [notice, setNotice] = useState("");
  const focusOrder = useRef(false);
  const [categoryOptions, setCategoryOptions] = useState<{ id: string | number; label: string }[]>([]);
  const { session } = useSession();
  const canPublish = session?.sites.find((item) => item.id === site)?.role !== "editor";
  const isArticle = kind === "articles";
  const singular = isArticle ? "Article" : kind === "modules" ? "Module" : "Product";
  const createLabel = isArticle ? "Add article" : kind === "modules" ? "Add module" : "Add product";
  const hasFilters = Boolean(params.get("q") || params.get("state") || params.get("category"));
  useEffect(() => {
    if (kind === "modules") return;
    if (site === "arms") { setCategoryOptions(Object.entries(categories).map(([id, label]) => ({ id, label }))); return; }
    const reference = kind === "civil-products" ? "civil-categories" : kind === "articles" ? "rubrics" : "categories";
    const abort = new AbortController();
    void api<{ items: typeof categoryOptions }>(`${site}/references/${reference}/`, { signal: abort.signal }).then((result) => setCategoryOptions(result.items)).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load categories."); });
    return () => abort.abort();
  }, [site, kind]);
  useEffect(() => { setSearch(params.get("q") || ""); }, [params]);
  useEffect(() => {
    if (ordering) return;
    const abort = new AbortController(); setList(null); setError("");
    void api<ProductList>(`${site}/${kind}/?${queryString}`, { signal: abort.signal }).then((value) => {
      setList(value);
    }).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load content."); });
    return () => abort.abort();
  }, [site, kind, queryString, attempt, ordering]);
  useEffect(() => {
    if (!list) return;
    const key = `cms-scroll:${site}:${kind}:${queryString}`;
    const remember = () => sessionStorage.setItem(key, String(window.scrollY));
    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, Number(sessionStorage.getItem(key) || 0));
      window.addEventListener("scroll", remember, { passive: true });
    });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", remember); };
  }, [list, site, kind, queryString]);
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params); next.delete("page"); if (value) next.set(key, value); else next.delete(key); setParams(next);
  }
  async function create() {
    setBusy(true); setCreationError(""); setCreationFields({});
    try {
      const doc = await api<CMSDocument>(`${site}/${kind}/`, { method: "POST", body: JSON.stringify({ name: draftName.trim(), template: isArticle ? "article" : "blank", ...(kind !== "modules" && (draftCategory || site !== "arms") ? { category: site === "arms" ? draftCategory : draftCategory ? Number(draftCategory) : null } : {}) }) });
      setCreating(false);
      await navigate(`/${site}/${kind}/${doc.id}?${new URLSearchParams({ from: queryString })}`);
    }
    catch (failure) { setCreationError(failure instanceof Error ? failure.message : "Unable to create content."); if (failure instanceof APIError) setCreationFields(failure.fields); }
    finally { setBusy(false); }
  }
  if (ordering) return <WebsiteOrder site={site} kind={kind} onClose={(applied) => { if (applied) setNotice(session?.environment === "local" ? "Order applied to the local copy. Public websites are unchanged." : "Website order updated."); focusOrder.current = true; setParams(new URLSearchParams(params.get("return") || "")); }} />;
  return <section className="cms-page"><header className="cms-page-heading"><div><h1>{collectionNames[kind] || "Content"}{list && <span className="cms-count">{list.total}</span>}</h1><p className="cms-muted">{site === "arms" ? "ARMS catalogue · arms.ai-def.com" : kind === "modules" ? "A module can be reused across multiple portal products." : isArticle ? "Articles and news · ai-def.com" : "Manage catalogue · ai-def.com"}</p></div><div className="cms-row-actions">{canPublish && kind !== "modules" && <button id="cms-website-order" ref={(element) => { if (element && focusOrder.current) { focusOrder.current = false; requestAnimationFrame(() => { if (element.isConnected) element.focus({ preventScroll: true }); }); } }} className="cms-button" onClick={() => { setNotice(""); setParams({ ordering: "1", return: queryString }); }}>Website order</button>}<button className="cms-button cms-primary" onClick={() => { setDraftName(""); setDraftCategory(""); setCreationError(""); setCreationFields({}); setCreating(true); }} disabled={busy}><Plus aria-hidden="true" />{busy ? "Please wait…" : createLabel}</button></div></header>
    {site === "ai-def" && ["products", "civil-products"].includes(kind) && <nav className="cms-catalog-tabs" aria-label="Catalogue"><Link aria-current={kind === "products" ? "page" : undefined} to={`/${site}/products`}>Main</Link><Link aria-current={kind === "civil-products" ? "page" : undefined} to={`/${site}/civil-products`}>Civil</Link></nav>}
    {kind === "portal" && <Link className="cms-button" to={`/${site}/modules`}>Shared modules</Link>}
    <div className="cms-list-tools"><form className="cms-search" role="search" onSubmit={(event) => { event.preventDefault(); filter("q", search.trim()); }}><Search aria-hidden="true" /><input type="search" aria-label={`Search: ${collectionNames[kind] || "content"}`} placeholder={isArticle ? "Search articles…" : kind === "modules" ? "Search modules…" : "Search products…"} value={search} onChange={(event) => { setSearch(event.target.value); if (!event.target.value) filter("q", ""); }} /><button type="submit">Search</button></form><Select aria-label="Publication state" value={params.get("state") || ""} onValueChange={(selectedValue) => filter("state", selectedValue)}><option value="">All states</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>{kind !== "modules" && <Select aria-label="Category" value={params.get("category") || ""} onValueChange={(selectedValue) => filter("category", selectedValue)}><option value="">All categories</option>{categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>}</div>
    {hasFilters && <div className="cms-filter-summary"><span>Filters applied{params.get("q") ? ` · «${params.get("q")}»` : ""}</span><button type="button" onClick={() => setParams({})}>Clear filters</button></div>}
    {notice && <p className="cms-notice" role="status">{notice}</p>}
    {error && <ErrorMessage message={error} retry={() => setAttempt((value) => value + 1)} />}
    {!list && !error ? <Loading label="Loading content…" /> : list && <><div className="cms-table-wrap"><table className={`cms-table${isArticle ? " is-articles" : ""}`}><caption className="cms-sr">{collectionNames[kind]} · {site === "arms" ? "ARMS" : "AI DEF"}</caption><thead><tr><th scope="col">{singular}</th>{kind !== "modules" && <th scope="col" className="cms-category-column">Category</th>}<th scope="col">State</th><th scope="col" className="cms-date-column">Updated</th></tr></thead><tbody>{list.items.map((row) => {
      const url = mediaURL(row.cover, row.media);
      const href = `/${site}/${kind}/${row.document_id || `live-${row.target_id}`}?${new URLSearchParams({ from: queryString })}`;
      return <tr key={row.document_id || row.target_id} data-target-id={row.target_id}><td><Link to={href} className="cms-product-name"><span className="cms-thumb">{url ? <CMSImage src={url} compact /> : <ImageOff aria-hidden="true" />}</span><strong title={row.name}>{row.name}</strong></Link></td>{kind !== "modules" && <td className="cms-category-column cms-muted">{categories[row.category] || row.category || "Not selected"}</td>}<td><span className={`cms-status cms-status-${row.status}`}>{statuses[row.status]}</span></td><td className="cms-date-column">{row.updated_at ? <time dateTime={row.updated_at}>{dateTime(row.updated_at)}</time> : <span className="cms-muted">No data</span>}</td></tr>;
    })}</tbody></table>{!list.items.length && <EmptyState title={hasFilters ? "No results found" : isArticle ? "No articles yet" : kind === "modules" ? "No modules yet" : "No products yet"} description={hasFilters ? "Change your search or clear the filters." : "Create your first item. You can save an incomplete draft and finish it later."}>{hasFilters && <button className="cms-button" onClick={() => setParams({})}>Clear filters</button>}</EmptyState>}</div><Pagination {...list} onPage={(page) => { const next = new URLSearchParams(params); next.set("page", String(page)); setParams(next); }} /></>}
    <Modal open={creating} onClose={() => setCreating(false)} preventDismiss={busy} title={createLabel} description={`${site === "arms" ? "ARMS catalogue" : kind === "portal" ? "AI DEF client portal" : kind === "modules" ? "AI DEF shared portal modules" : kind === "civil-products" ? "AI DEF civil catalogue" : "AI DEF website"}. This creates an English draft. It stays unpublished until reviewed.`}><form onSubmit={(event) => { event.preventDefault(); void create(); }}><fieldset className="cms-editor-fields" disabled={busy}><label className="cms-field"><span>{isArticle ? "Article title" : `${singular} name`} <small className="cms-required">Required</small></span><input autoFocus maxLength={255} required value={draftName} aria-invalid={Boolean(creationFields.name)} aria-describedby={creationFields.name ? "new-draft-name-error" : undefined} onChange={(event) => { setDraftName(event.target.value); setCreationFields((value) => ({ ...value, name: "" })); }} />{creationFields.name && <small className="cms-field-error" id="new-draft-name-error">{creationFields.name}</small>}</label>{kind !== "modules" && <label className="cms-field"><span>Category <small>Can be changed later</small></span><Select value={draftCategory} aria-label="New draft category" onValueChange={setDraftCategory}><option value="">{site === "arms" ? "Default: Pistols" : "Not selected"}</option>{categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></label>}{creationError && <ErrorMessage message={creationError} fields={creationFields} />}</fieldset><footer className="cms-dialog-actions"><button type="button" className="cms-button" disabled={busy} onClick={() => setCreating(false)}>Cancel</button><button type="submit" className="cms-button cms-primary" disabled={busy || !draftName.trim()}>{busy ? "Creating…" : "Create draft"}</button></footer></form></Modal>
  </section>;
}
