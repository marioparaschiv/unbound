import type { DocsGroupKey } from '~/lib/docs/kinds';

export type SearchableSymbol = {
	name: string;
	qualifiedName: string;
	group: DocsGroupKey;
};

/** Lower ranks list first. */
function rank(symbol: SearchableSymbol, query: string): number | undefined {
	const name = symbol.name.toLowerCase();
	const qualified = symbol.qualifiedName.toLowerCase();

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
 * @description Finds the symbols matching a search, best first: exact names, then name prefixes, then
 * qualified-name prefixes, then substrings; ties keep their order.
 * @param symbols The symbols to search, in sidebar order.
 * @param query The search text; case-insensitive.
 * @param limit The most results to return.
 * @returns The matches.
 */
export function searchSymbols<T extends SearchableSymbol>(
	symbols: T[],
	query: string,
	limit = 50,
): T[] {
	const needle = query.trim().toLowerCase();

	if (!needle) {
		return [];
	}

	return symbols
		.flatMap((symbol) => {
			const score = rank(symbol, needle);

			return score === undefined ? [] : [{ symbol, score }];
		})
		.sort((a, b) => a.score - b.score)
		.slice(0, limit)
		.map(({ symbol }) => symbol);
}

export default { searchSymbols };
