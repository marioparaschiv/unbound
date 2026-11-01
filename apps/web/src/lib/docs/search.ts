import type { DocsLocation } from '~/lib/docs/docs-index';
import type { DocsSearchKind } from '~/lib/docs/kinds';
import type { DocsNav } from '~/lib/docs/docs-page';

/** One thing the `⌘K` search finds: a page, or a member at an anchor on its owner's page. */
export type DocsSearchEntry = {
	name: string;
	qualifiedName: string;
	kind: DocsSearchKind;
	location: DocsLocation;
};

/** Match tiers, best first; within a tier a page outranks a member. */
function tier(entry: DocsSearchEntry, query: string): number | undefined {
	const name = entry.name.toLowerCase();
	const qualified = entry.qualifiedName.toLowerCase();

	if (name === query || qualified === query) {
		return 0;
	}

	if (name.startsWith(query)) {
		return 1;
	}

	if (qualified.startsWith(query)) {
		return 2;
	}

	if (name.includes(query)) {
		return 3;
	}

	return qualified.includes(query) ? 4 : undefined;
}

/**
 * @description Lists what a version's search covers: every page in sidebar order, then every member a page lists.
 * @param nav The version's navigation.
 * @returns The entries.
 */
export function getSearchEntries(nav: Pick<DocsNav, 'groups' | 'members'>): DocsSearchEntry[] {
	const pages = nav.groups.flatMap((group) =>
		group.symbols.map((symbol) => ({
			...symbol,
			kind: group.key,
			location: { symbol: symbol.qualifiedName },
		})),
	);
	const members = nav.members.flatMap(({ owner, names }) =>
		names.map((name) => ({
			name,
			qualifiedName: `${owner}.${name}`,
			kind: 'members' as const,
			location: { symbol: owner, anchor: name },
		})),
	);

	return [...pages, ...members];
}

/**
 * @description Finds the entries matching a search, best first: exact names, then name prefixes, then
 * qualified-name prefixes, then substrings. In each tier pages come before members; ties keep their order.
 * @param entries The entries to search, from {@link getSearchEntries}.
 * @param query The search text; case-insensitive.
 * @param limit The most results to return.
 * @returns The matches.
 */
export function searchDocs(
	entries: DocsSearchEntry[],
	query: string,
	limit = 50,
): DocsSearchEntry[] {
	const needle = query.trim().toLowerCase();

	if (!needle) {
		return [];
	}

	return entries
		.flatMap((entry) => {
			const match = tier(entry, needle);

			return match === undefined
				? []
				: [{ entry, score: match * 2 + (entry.kind === 'members' ? 1 : 0) }];
		})
		.sort((a, b) => a.score - b.score)
		.slice(0, limit)
		.map(({ entry }) => entry);
}

export default { getSearchEntries, searchDocs };
