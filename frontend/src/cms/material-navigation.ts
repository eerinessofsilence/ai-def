import type { CMSDocument, ProductList, ProductRow } from "./api";

export type MaterialNeighbor = { row: ProductRow; page: number };

export async function materialNeighbors(document: Pick<CMSDocument, "id" | "target_id">, page: number, load: (page: number) => Promise<ProductList>) {
  const result = await load(page);
  const index = result.items.findIndex((row) => row.document_id === document.id || document.target_id !== null && row.target_id === document.target_id);
  if (index < 0) return { found: false, previous: null, next: null };
  let previous: MaterialNeighbor | null = index ? { row: result.items[index - 1], page: result.page } : null;
  let next: MaterialNeighbor | null = index + 1 < result.items.length ? { row: result.items[index + 1], page: result.page } : null;
  const adjacent = await Promise.all([
    !previous && result.page > 1 ? load(result.page - 1) : null,
    !next && result.page < result.pages ? load(result.page + 1) : null,
  ]);
  if (adjacent[0]?.page === result.page - 1 && adjacent[0].items.length) previous = { row: adjacent[0].items.at(-1)!, page: adjacent[0].page };
  if (adjacent[1]?.page === result.page + 1 && adjacent[1].items.length) next = { row: adjacent[1].items[0], page: adjacent[1].page };
  return { found: true, previous, next };
}
