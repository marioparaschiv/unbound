import type { FilterOption } from '~/lib/prototype/addon-filters';
import { TAGGED_ADDONS } from '~/lib/prototype/addon-filters';
import { getDefaultAvatarUrl } from '~/lib/discord';

export type AuthorPage = {
	options: FilterOption[];
	/** The next page's cursor, or `null` after the last page. */
	next: number | null;
	/** How many authors match in all, so rows can announce "3 of 54". */
	total: number;
};

/** How many authors one request returns; skeletons render this many rows so nothing shifts. */
export const AUTHOR_PAGE_SIZE = 12;

// Long enough to see the skeletons, short enough not to annoy.
const LATENCY_MS = 650;

const EXTRA_NAMES = [
	'Ari',
	'Bea',
	'Cass',
	'Dex',
	'Eli',
	'Fern',
	'Gus',
	'Hana',
	'Ivo',
	'Jade',
	'Kai',
	'Lumi',
	'Milo',
	'Nia',
	'Otto',
	'Pia',
	'Quin',
	'Rhea',
	'Sol',
	'Tove',
	'Uma',
	'Vik',
	'Wren',
	'Xan',
	'Yara',
	'Zed',
	'Alba',
	'Bram',
	'Cleo',
	'Dune',
	'Edda',
	'Finn',
	'Gaia',
	'Hugo',
	'Isla',
	'Jonas',
	'Kira',
	'Leon',
	'Mara',
	'Nico',
	'Oona',
	'Pax',
	'Rio',
	'Saga',
	'Tao',
	'Vera',
	'Wim',
	'Zoe',
];

const COUNTS = new Map<string, number>();

for (const addon of TAGGED_ADDONS) {
	for (const author of addon.authors) {
		COUNTS.set(author.name, (COUNTS.get(author.name) ?? 0) + 1);
	}
}

/** Every author on the marketplace, most addons first, the way the real endpoint would order them. */
const DIRECTORY: FilterOption[] = [...COUNTS.keys(), ...EXTRA_NAMES]
	.map((name, index) => ({
		value: name,
		label: name,
		color: null,
		avatarUrl: getDefaultAvatarUrl(String(BigInt(index + 1) << 22n)),
		count: COUNTS.get(name) ?? 0,
	}))
	.toSorted((a, b) => b.count - a.count || a.label.localeCompare(b.label));

/**
 * @description Fakes one page of the author directory with network latency; the real endpoint pages by keyset cursor.
 * @param cursor Where the page starts.
 * @param query Text the author's name must contain.
 * @returns The page, the next cursor and the match total.
 */
export function fetchAuthorPage(cursor: number, query: string): Promise<AuthorPage> {
	const needle = query.trim().toLowerCase();
	const matching = needle
		? DIRECTORY.filter((option) => option.label.toLowerCase().includes(needle))
		: DIRECTORY;
	const end = cursor + AUTHOR_PAGE_SIZE;

	return new Promise((resolve) => {
		setTimeout(
			() =>
				resolve({
					options: matching.slice(cursor, end),
					next: end < matching.length ? end : null,
					total: matching.length,
				}),
			LATENCY_MS,
		);
	});
}

export default { AUTHOR_PAGE_SIZE, fetchAuthorPage };
