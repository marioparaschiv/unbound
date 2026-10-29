import { z } from '@unbound-app/contracts/zod';

/** The URL search of a searchable, paginated list page. */
export const pageSearchSchema = z.object({
	page: z.optional(z.coerce.number().check(z.int(), z.minimum(1))),
	search: z.optional(z.string().check(z.maxLength(100))),
});

export type PageSearch = z.infer<typeof pageSearchSchema>;

/**
 * @description Builds a list page's URL search, leaving defaults out so the first page stays canonical.
 * @param search The search text.
 * @param page The 1-based page.
 * @returns The URL search.
 */
export function toPageSearch(search: string, page: number): PageSearch {
	return { search: search || undefined, page: page > 1 ? page : undefined };
}

export default { pageSearchSchema, toPageSearch };
