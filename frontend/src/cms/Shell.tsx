import Select from "../../components/ui/select";
import { useEffect, useRef, useState } from "react";
import { Boxes, ChevronRight, BookOpen, FileText, Images, LogOut, Menu, X, Grid2X2, Mail, PanelsTopLeft, Settings } from "lucide-react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSession } from "./session";
import { ConnectionState } from "./ui";
import CMSGuide from "./CMSGuide";

export default function Shell() {
  const { session, loading, error, reload, signOut } = useSession();
  const { site } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width:850px)").matches);
  const [accountError, setAccountError] = useState("");
  const sidebar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const guideButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => { setGuideOpen(false); }, [location.key]);
  useEffect(() => {
    const query = window.matchMedia("(max-width:850px)");
    const changed = () => { setMobile(query.matches); if (!query.matches) setMenu(false); };
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (guideOpen) return;
    if (!menu) {
      if (wasOpen.current) window.requestAnimationFrame(() => menuButton.current?.focus());
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),select') || []).filter((element) => element.offsetParent !== null);
    focusable()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMenu(false); }
      if (event.key === "Tab") {
        const items = focusable(); const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyboard);
    };
  }, [menu, guideOpen]);
  if (loading || error) return <ConnectionState error={error} retry={() => { void reload(); }} />;
  if (!session?.authenticated) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  const workspace = session.sites.find((item) => item.id === site);
  if (!workspace) return <Navigate to={session.sites.length ? `/${session.sites[0].id}/products` : "/login"} replace />;
  const domain = site === "arms" ? "arms.ai-def.com" : "ai-def.com";
  const route = location.pathname.split("/").filter(Boolean);
  const sectionNames: Record<string, string> = { products: "Products", "civil-products": "Civil catalogue", articles: "Articles", pages: "Pages", media: "Media library", inquiries: "Inquiries", portal: "Client portal", modules: "Shared modules", settings: "Settings" };
  const section = sectionNames[route[1]] || "Products";
  const local = session.environment === "local";
  function closeGuide() {
    setGuideOpen(false);
    const modalOpen = Boolean(document.querySelector(".cms-overlay"));
    setMenu(mobile && !modalOpen);
    requestAnimationFrame(() => { if (!modalOpen) guideButton.current?.focus({ preventScroll: true }); });
  }
  return <div className={`cms-app${guideOpen ? " is-guiding" : ""}`}>
    {menu && <button className="cms-nav-overlay" aria-label="Close menu" onClick={() => setMenu(false)} />}
    <aside ref={sidebar} inert={mobile && !menu} role={menu ? "dialog" : undefined} aria-modal={menu || undefined} aria-label="CMS navigation" className={`cms-sidebar${menu ? " is-open" : ""}`}>
      <div className="cms-brand"><img src="/logo-ai-def.svg" alt="AI DEF" width="120" height="34" /><button className="cms-icon cms-mobile" onClick={() => setMenu(false)} aria-label="Close menu"><X /></button></div>
      <label className="cms-workspace" data-cms-guide="site"><span>Site</span><Select value={site} onValueChange={(selectedValue) => { setMenu(false); void navigate(`/${selectedValue}/products`); }} aria-label="Site workspace">{session.sites.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><small>{domain}</small></label>
      <nav aria-label="CMS sections"><span className="cms-sidebar-caption">Workspace</span><NavLink data-cms-guide="products" to={`/${site}/products`} className={location.pathname.includes("/civil-products") ? "is-active" : undefined} onClick={() => setMenu(false)}><Boxes aria-hidden="true" />Products</NavLink>{site === "ai-def" && <NavLink data-cms-guide="articles" to={`/${site}/articles`} onClick={() => setMenu(false)}><FileText aria-hidden="true" />Articles</NavLink>}<NavLink data-cms-guide="pages" to={`/${site}/pages`} onClick={() => setMenu(false)}><PanelsTopLeft aria-hidden="true" />Pages</NavLink><NavLink data-cms-guide="media" to={`/${site}/media`} onClick={() => setMenu(false)}><Images aria-hidden="true" />Media library</NavLink><NavLink data-cms-guide="inquiries" to={`/${site}/inquiries`} onClick={() => setMenu(false)}><Mail aria-hidden="true" />Inquiries</NavLink>{workspace.can_portal && <NavLink data-cms-guide="portal" to={`/${site}/portal`} onClick={() => setMenu(false)}><Grid2X2 aria-hidden="true" />Client portal</NavLink>}<NavLink data-cms-guide="settings" to={`/${site}/settings`} onClick={() => setMenu(false)}><Settings aria-hidden="true" />Settings</NavLink></nav>
      <div className="cms-sidebar-bottom"><button ref={guideButton} type="button" onClick={() => setGuideOpen(true)}><BookOpen aria-hidden="true" />CMS guide</button><div className="cms-account" title={session.user?.name}>{session.user?.name}<small className="cms-account-role">{{ editor: "Editor", publisher: "Publisher", manager: "Site manager" }[workspace.role]}</small></div><button onClick={() => { void signOut().catch((failure: unknown) => setAccountError(failure instanceof Error ? failure.message : "Unable to sign out.")); }}><LogOut aria-hidden="true" />Sign out</button>{accountError && <p role="alert">{accountError}</p>}</div>
    </aside>
    {guideOpen && <CMSGuide site={workspace.id} kind={route[1]} manager={workspace.role === "manager"} canPublish={workspace.role !== "editor"} local={local} onSidebar={setMenu} onClose={closeGuide} />}
    <div className="cms-main"><header className="cms-mobile-header"><button ref={menuButton} className="cms-icon" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}><Menu /></button><Link to={`/${site}/products`}><img src="/logo-ai-def.svg" alt="AI DEF" width="94" height="27" /></Link><span>{workspace.name}</span></header>{local && <div className="cms-environment"><strong>Local copy</strong><span>Changes stay here. Public websites are unchanged.</span></div>}{route.length <= 2 && <nav className="cms-breadcrumbs" aria-label="Breadcrumbs"><Link to={`/${site}/products`}>{workspace.name}</Link><ChevronRight aria-hidden="true" /><span aria-current="page">{section}</span></nav>}<Outlet /></div>
  </div>;
}
