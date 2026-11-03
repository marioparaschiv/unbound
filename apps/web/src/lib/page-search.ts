import { Type, type StaticDecode } from '@unbound-app/contracts/schema';

// Search parameters arrive as text, so the page number is checked as text and decoded, as `z.coerce` did.
const pageNumber = Type.Decode(
	Type.Refine(
		Type.Union([Type.String(), Type.Number()]),
		(value: string | number) => Number.isInteger(Number(value)) && Number(value) >= 1,
		() => 'Too small: expected number to be >=1',
	),
	Number,
);

/** The URL search of a searchable, paginated list page. */
export const pageSearchSchema = Type.Object({
	page: Type.Optional(pageNumber),
	search: Type.Optional(Type.String({ maxLength: 100 })),
});

export type PageSearch = StaticDecode<typeof pageSearchSchema>;

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
