import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

type Step = { target: string; title: string; text: string; sidebar?: boolean };
type Box = { left: number; top: number; width: number; height: number };

export default function CMSGuide({ site, kind, manager, canPublish, local, onSidebar, onClose }: {
  site: string; kind: string; manager: boolean; canPublish: boolean; local: boolean;
  onSidebar: (open: boolean) => void; onClose: () => void;
}) {
  const [steps] = useState<Step[]>(() => {
    const sidebar = true;
    const overview: Step[] = [
      { target: '[data-cms-guide="site"]', title: "Choose a website", sidebar, text: "AI DEF and ARMS have separate content and media libraries. Check the selected site before you start editing." },
      { target: '[data-cms-guide="products"]', title: "Products", sidebar, text: site === "arms" ? "Open a product to edit its information, cover, specifications and variants. Each variant has its own photos. Add product creates an unpublished draft." : "Open a product to edit its information, images, specifications and page content. Main and Civil are separate catalogues. Add product creates an unpublished draft." },
      { target: '[data-cms-guide="articles"], [data-cms-guide="pages"]', title: site === "arms" ? "Website pages" : "Articles and pages", sidebar, text: site === "arms" ? "Pages lets you update text, images and documents in the existing page layouts. The page addresses and layouts stay fixed." : "Articles are built from text, image and other content blocks. Pages lets you edit the predefined sections of existing website pages." },
      { target: '[data-cms-guide="media"]', title: "Media library", sidebar, text: "Upload files or reuse existing ones. Open a file to rename it in the library and see where it is used. Image descriptions are edited in each material." },
      { target: '[data-cms-guide="inquiries"]', title: "Inquiries", sidebar, text: "Website form submissions arrive here. Open a message, set its status, assign a team member and save an internal note. Internal notes are not sent to the customer." },
      { target: '[data-cms-guide="portal"]', title: "Client portal", sidebar, text: "Manage portal products, specification groups and modules here. A shared module can be used by several products; publishing a module updates all products that use it." },
      { target: '[data-cms-guide="settings"]', title: "Settings and access", sidebar, text: manager ? "Change your password and manage access to the selected site. Editors prepare drafts, publishers publish content, and site managers also manage team access." : "Change your account password here. Your role determines which actions are available. Ask a site manager if you need additional access." },
    ];
    if (document.querySelector(".cms-editor")) {
      overview.push(
        { target: ".cms-section-nav", title: "Edit one section at a time", text: kind === "pages" ? "These tabs match the sections of this page. Images and files contains shared media. Properties shows the fixed page address and translation overview." : kind === "articles" ? "Write the article under Article text, then choose its images. Properties contains the category, author, publication date and page address. Keep an existing address so links continue to work." : kind === "modules" ? "Edit the module name and description under General, then manage its images and specifications. This content is shared by every portal product that uses the module." : kind === "portal" ? "Edit the general information, images, specifications, page content and module placements in these tabs. Properties contains the category, serial number, tags and page address." : site === "arms" ? "Edit general information, the cover and shared specifications here. Variants contains the names, photos and specifications of each version. Properties contains the category, manufacturer and page address." : "Edit general information, images, specifications and page content in these tabs. Properties contains the category and page address. Keep an existing address so links continue to work." },
        { target: ".cms-language", title: "Translate from English", text: "Choose the content language here. Compare with EN shows the original beside translated fields. Empty translations use English. Completion counts filled fields; Mark as reviewed records your manual check." },
        { target: ".cms-editor-actions", title: "Save, preview and publish", text: `Edits are saved automatically as a draft. Save draft or Ctrl/⌘+S saves immediately. ${kind === "modules" ? "Publication review lists the products affected by this shared module." : "Preview shows the saved page."} ${canPublish ? "Review changes checks the draft before you publish the material and all its translations." : "A publisher must review and publish your draft."} More actions contains version history and recovery options.${local ? " This is a local copy: public websites are unchanged." : ""}` },
      );
    } else {
      const current = kind === "media" ? { target: ".cms-media-tabs", title: "Upload or choose a file", text: "Drop files into the library or use Upload. In a material, choose a file and confirm Use file to insert it. Uploading a file alone does not replace an image on the website." }
        : kind === "inquiries" ? { target: ".cms-main .cms-list-tools", title: "Find a message", text: "Search messages and filter by status or Assigned to me. Open a message to read it and update its workflow. Use Save changes to save the status, assignee and note." }
        : kind === "settings" ? { target: ".cms-main .cms-page-heading", title: manager ? "Work with your team" : "Keep your account secure", text: manager ? "A password change applies to your account. Team access changes apply to the selected site. Read the confirmation before changing a role or removing access." : "Enter your current password and a strong new password, then choose Change password. This updates your account for every site you can access." }
        : kind === "pages" ? { target: ".cms-pages-list", title: "From draft to published page", text: `Open a page, choose a section and edit its content. Changes save as a draft. Use Preview to check the result. ${canPublish ? "Review changes checks the page before publication." : "Ask a publisher to review and publish your draft."} Version history lets you restore earlier content.` }
        : { target: ".cms-main .cms-list-tools", title: "Find, edit and publish content", text: `Use search and filters to find a material, then open its name. Add creates a new draft. Changes save automatically. ${kind === "modules" ? "Review shows which products use the shared module." : "Preview checks the saved result."} ${canPublish ? "Review changes leads to publication." : "A publisher reviews and publishes your draft."} Run CMS guide inside an editor for a tour of its controls.` };
      overview.push(current);
    }
    return overview.filter((step) => document.querySelector(step.target));
  });
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState<{ box: Box | null; left: number; top: number; width: number }>({ box: null, left: 16, top: 16, width: Math.min(360, window.innerWidth - 32) });
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const step = steps[index];
  useEffect(() => {
    const scroll = { x: window.scrollX, y: window.scrollY, sidebar: document.querySelector(".cms-sidebar")?.scrollTop || 0 };
    window.dispatchEvent(new Event("cms-modal-open"));
    const stop = () => close.current();
    window.addEventListener("cms-modal-open", stop);
    return () => {
      window.removeEventListener("cms-modal-open", stop);
      window.scrollTo(scroll.x, scroll.y);
      const sidebar = document.querySelector(".cms-sidebar");
      if (sidebar) sidebar.scrollTop = scroll.sidebar;
    };
  }, []);
  useLayoutEffect(() => {
    if (!step) return;
    const targets = Array.from(document.querySelectorAll<HTMLElement>(step.target));
    const showSidebar = () => onSidebar(Boolean(step.sidebar) && window.matchMedia("(max-width:850px)").matches);
    showSidebar();
    const measure = () => {
      const width = Math.min(360, window.innerWidth - 32);
      const height = Math.min(card.current?.offsetHeight || 260, window.innerHeight - 32);
      const rects = targets.filter((target) => target.getClientRects().length).map((target) => target.getBoundingClientRect());
      let box: Box | null = null;
      let left = (window.innerWidth - width) / 2;
      let top = (window.innerHeight - height) / 2;
      if (rects.length) {
        const x = Math.max(8, Math.min(...rects.map((rect) => rect.left)) - 6);
        const y = Math.max(8, Math.min(...rects.map((rect) => rect.top)) - 6);
        const right = Math.min(window.innerWidth - 8, Math.max(...rects.map((rect) => rect.right)) + 6);
        const bottom = Math.min(window.innerHeight - 8, Math.max(...rects.map((rect) => rect.bottom)) + 6);
        if (right > x && bottom > y) {
          box = { left: x, top: y, width: right - x, height: bottom - y };
          if (right + 16 + width <= window.innerWidth - 16) { left = right + 16; top = y + (box.height - height) / 2; }
          else if (x - 16 - width >= 16) { left = x - 16 - width; top = y + (box.height - height) / 2; }
          else { left = x; top = bottom + 16 + height <= window.innerHeight - 16 ? bottom + 16 : y - 16 - height >= 16 ? y - 16 - height : window.innerHeight - 16 - height; }
        }
      }
      setPosition({ box, width, left: Math.max(16, Math.min(left, window.innerWidth - 16 - width)), top: Math.max(16, Math.min(top, window.innerHeight - 16 - height)) });
    };
    const frame = requestAnimationFrame(() => { targets[0]?.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }); measure(); heading.current?.focus({ preventScroll: true }); });
    const resize = () => { showSidebar(); measure(); };
    const observer = new ResizeObserver(measure);
    targets.forEach((target) => observer.observe(target));
    if (card.current) observer.observe(card.current);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", measure, true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", resize); window.removeEventListener("scroll", measure, true); };
  }, [step, onSidebar]);
  if (!step) return null;
  const { box } = position;
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="cms-guide-overlay" data-highlight={Boolean(box)}>{box && <div aria-hidden="true" className="cms-guide-spotlight" style={box} />}</Dialog.Overlay>
    <Dialog.Content ref={card} className="cms-modal cms-guide" style={{ left: position.left, top: position.top, width: position.width }} onCloseAutoFocus={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()}>
      <header><span className="cms-muted" aria-live="polite">CMS guide · {index + 1} of {steps.length}</span><Dialog.Close className="cms-icon" aria-label="Close guide"><X /></Dialog.Close></header>
      <div className="cms-guide-step" key={index}><Dialog.Title ref={heading} tabIndex={-1}>{step.title}</Dialog.Title><Dialog.Description className="cms-muted">{step.text}</Dialog.Description></div>
      <footer><button type="button" className="cms-button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}><ArrowLeft aria-hidden="true" />Back</button><button type="button" className="cms-button cms-primary" onClick={() => { if (index === steps.length - 1) onClose(); else setIndex((value) => value + 1); }}>{index === steps.length - 1 ? "Done" : "Next"}{index < steps.length - 1 && <ArrowRight aria-hidden="true" />}</button></footer>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
