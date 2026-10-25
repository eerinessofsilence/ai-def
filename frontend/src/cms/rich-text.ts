export function safeLink(value: string): string | null {
  const href = value.trim();
  // Reject control characters before browser URL normalisation.
  // eslint-disable-next-line no-control-regex
  if (!href || /[\u0000-\u001f\u007f\\]/.test(href)) return null;
  if (/^(mailto:|tel:).+/i.test(href) || /^(\/(?!\/)|#)/.test(href)) return href;
  if (!/^https?:\/\//i.test(href)) return null;
  try { return new URL(href).hostname ? href : null; } catch { return null; }
}

export function sanitisePaste(html: string, doc: Document = document) {
  // Template content is inert. Only reconstructed elements enter the editor.
  const template = doc.createElement("template");
  template.innerHTML = html;
  const result = doc.createElement("div");
  const allowed = new Set(["p", "br", "strong", "em", "u", "s", "a", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "hr"]);
  const dropped = new Set(["script", "style", "iframe", "object", "embed", "svg", "math", "form", "input", "button", "select", "textarea", "video", "audio", "canvas", "link", "meta", "base", "img"]);
  let omitted = false;
  function append(node: Node, parent: Node) {
    if (node.nodeType === 3) { parent.appendChild(doc.createTextNode(node.textContent || "")); return; }
    if (node.nodeType !== 1) return;
    const element = node as HTMLElement;
    const source = element.tagName.toLowerCase();
    if (dropped.has(source)) { omitted = true; return; }
    let tag = ({ b: "strong", i: "em", strike: "s", h1: "h2", h5: "h4", h6: "h4", tr: "p" } as Record<string, string>)[source] || source;
    if (source === "div") tag = Array.from(element.children).some((child) => /^(P|DIV|H[1-6]|UL|OL|BLOCKQUOTE)$/.test(child.tagName)) ? "span" : "p";
    if (source === "b" && /^(normal|400)$/.test(element.style.fontWeight)) tag = "span";
    let target = parent;
    if (tag === "a") {
      const href = safeLink(element.getAttribute("href") || "");
      if (href) { const link = doc.createElement("a"); link.setAttribute("href", href); link.setAttribute("rel", "noopener noreferrer"); parent.appendChild(link); target = link; }
      else omitted = true;
    } else if (allowed.has(tag)) {
      const clean = doc.createElement(tag); parent.appendChild(clean); target = clean;
    } else if (!["span", "div", "table", "thead", "tbody", "tfoot", "td", "th"].includes(source)) omitted = true;
    const formats = [
      !["strong", "b"].includes(tag) && /^(bold|[6-9]00)$/.test(element.style.fontWeight) ? "strong" : "",
      tag !== "em" && element.style.fontStyle === "italic" ? "em" : "",
      tag !== "u" && /underline/.test(element.style.textDecoration) ? "u" : "",
      tag !== "s" && /line-through/.test(element.style.textDecoration) ? "s" : "",
    ].filter(Boolean);
    for (const format of formats) { const wrapper = doc.createElement(format); target.appendChild(wrapper); target = wrapper; }
    for (const child of Array.from(element.childNodes)) append(child, target);
    if (["td", "th"].includes(source)) parent.appendChild(doc.createTextNode(" "));
  }
  for (const child of Array.from(template.content.childNodes)) append(child, result);
  return { html: result.innerHTML, omitted };
}
