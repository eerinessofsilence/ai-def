const help: Record<string, [string, string]> = {
  main: ["Product introduction", "The name and description introduce this product on its page. Other languages can use English until translated."],
  photos: ["Images on the website", "Main images appear at the top of the product page. Gallery and section images appear in their own positions below."],
  specs: ["Product specifications", "Names and values appear in the overview or specifications area. Only add information intended for visitors."],
  blocks: ["Sections below the overview", "Technology, benefits, text with images and calls to action follow the main product information. Open each block to change its content."],
  variants: ["Variants of this product", "The variant selector controls names, photos and specifications for each version. Manufacturer and category are shared by the whole product."],
  modules: ["Modules in the client portal", "Placements belong to this product. Editing a shared module changes its content for every linked product."],
  properties: ["Properties and website URL", "Category and URL organise the material. Keep an existing URL so links to this page continue to work."],
  legacy: ["Previous article structure", "This content is preserved for compatibility. New article blocks take precedence when present."],
};

export default function SectionGuide({ kind, section }: { kind: string; section: string }) {
  const [title, description] = kind === "modules" ? ["Shared module content", "This module is reused by portal products. Review changes lists the products affected by publication."]
    : kind === "articles" && section === "blocks" ? ["Article introduction and body", "Prepare the title and summary, then arrange the article blocks in reading order. The cover is managed under Images."]
    : kind === "pages" ? [section === "media" ? "Page images and files" : "Content in the existing page layout", section === "media" ? "Files are shared across languages. Use Preview to check each image in its real position." : "Edit the copy for this section. The page layout and URL are fixed. Preview shows the real page; Inspect fields connects selectable text to this form."]
    : help[section] || ["Prepare this section", "Save a draft, check the real page in Preview, then review changes before publishing."];
  return <section className="cms-section-guide" aria-label="Section help"><details key={`${kind}:${section}`}><summary>{title}</summary><p>{description}</p></details></section>;
}
