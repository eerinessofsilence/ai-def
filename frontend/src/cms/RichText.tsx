import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link, List, ListOrdered, Quote, Unlink } from "lucide-react";
import { Modal } from "./ui";
import { safeLink, sanitisePaste } from "./rich-text";

export default function RichText({ value, onChange, id, label, invalid, describedBy, disabled = false }: { disabled?: boolean; value: string; onChange: (value: string) => void; id: string; label: string; invalid?: boolean; describedBy?: string }) {
  const element = useRef<HTMLDivElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [notice, setNotice] = useState("");
  const selection = useRef<Range | null>(null);
  const [format, setFormat] = useState({ bold: false, italic: false, list: false, ordered: false, link: false, block: "" });
  useEffect(() => {
    const update = () => {
      const selected = window.getSelection();
      if (!selected?.anchorNode || !element.current?.contains(selected.anchorNode)) return;
      const anchor = selected.anchorNode instanceof Element ? selected.anchorNode : selected.anchorNode.parentElement;
      setFormat({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"), list: document.queryCommandState("insertUnorderedList"), ordered: document.queryCommandState("insertOrderedList"), link: Boolean(anchor?.closest("a")), block: String(document.queryCommandValue("formatBlock")).toLowerCase() });
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);
  useEffect(() => {
    if (element.current && element.current !== document.activeElement && element.current.innerHTML !== value) element.current.innerHTML = value;
  }, [value]);
  function command(name: string, argument?: string) {
    if (disabled) return;
    element.current?.focus();
    document.execCommand(name, false, argument);
    onChange(element.current?.innerHTML || "");
  }
  function openLink() {
    const selected = window.getSelection();
    if (!selected?.rangeCount || !selected.anchorNode || !selected.focusNode || !element.current?.contains(selected.anchorNode) || !element.current.contains(selected.focusNode)) { setNotice("Select text in the editor before adding a link."); return; }
    const anchor = (selected.anchorNode instanceof Element ? selected.anchorNode : selected.anchorNode.parentElement)?.closest("a");
    const range = selected.getRangeAt(0).cloneRange();
    if (anchor) range.selectNodeContents(anchor);
    if (range.collapsed) { setNotice("Select the text you want to link first."); return; }
    selection.current = range; setHref(anchor?.getAttribute("href") || ""); setLinkOpen(true); setNotice("");
  }
  return <div className="cms-richtext" data-invalid={invalid}><fieldset disabled={disabled} className="cms-format-tools" role="toolbar" aria-label="Text formatting">
    <button type="button" className="cms-icon" aria-label="Bold" aria-pressed={format.bold} onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")}><Bold /></button>
    <button type="button" className="cms-icon" aria-label="Italic" aria-pressed={format.italic} onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")}><Italic /></button>
    <button type="button" className="cms-button" aria-pressed={format.block === "h2"} onMouseDown={(event) => event.preventDefault()} onClick={() => command("formatBlock", "h2")}>Heading H2</button>
    <button type="button" className="cms-icon" aria-label="Bulleted list" aria-pressed={format.list} onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertUnorderedList")}><List /></button>
    <button type="button" className="cms-icon" aria-label="Numbered list" aria-pressed={format.ordered} onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertOrderedList")}><ListOrdered /></button>
    <button type="button" className="cms-icon" aria-label="Quote" aria-pressed={format.block === "blockquote"} onMouseDown={(event) => event.preventDefault()} onClick={() => command("formatBlock", "blockquote")}><Quote /></button>
    <button type="button" className="cms-icon" aria-label={format.link ? "Edit link" : "Insert link"} aria-pressed={format.link} onMouseDown={(event) => event.preventDefault()} onClick={openLink}><Link /></button>
    <button type="button" className="cms-icon" aria-label="Remove link" disabled={!format.link} onMouseDown={(event) => event.preventDefault()} onClick={() => command("unlink")}><Unlink /></button>
    <button type="button" className="cms-button" onMouseDown={(event) => event.preventDefault()} onClick={() => { command("removeFormat"); command("formatBlock", "p"); }}>Paragraph</button>
  </fieldset><div id={id} className="cms-richtext-body" ref={element} contentEditable={!disabled} aria-disabled={disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label} aria-invalid={invalid} aria-describedby={describedBy} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openLink(); } }} onInput={(event) => onChange(event.currentTarget.innerHTML)} onPaste={(event) => { event.preventDefault(); const html = event.clipboardData.getData("text/html"); if (html) { const clean = sanitisePaste(html); command("insertHTML", clean.html); setNotice(`Pasted with supported formatting.${clean.omitted ? " Some unsupported content was omitted. Add images from the media library." : ""}`); } else { command("insertText", event.clipboardData.getData("text/plain")); setNotice(""); } }} />{notice && <p className="cms-context" role="status">{notice}</p>}
  <Modal open={linkOpen && !disabled} onClose={() => setLinkOpen(false)} title="Add or edit link" description="Select text in the editor, then enter a web address, email, phone or page link."><label className="cms-field"><span>Link URL</span><input type="url" value={href} placeholder="https://" onChange={(event) => setHref(event.target.value)} /></label><footer><button className="cms-button" onClick={() => setLinkOpen(false)}>Cancel</button><button className="cms-button cms-primary" disabled={!safeLink(href)} onClick={() => {
    setLinkOpen(false);
    window.setTimeout(() => { element.current?.focus(); const selected = window.getSelection(); if (selection.current && selected && safeLink(href)) { selected.removeAllRanges(); selected.addRange(selection.current); command("createLink", safeLink(href)!); } }, 0);
  }}>Add</button></footer></Modal></div>;
}
