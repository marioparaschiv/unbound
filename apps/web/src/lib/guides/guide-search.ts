import type { Guide } from '~/lib/guides/guides';

/** One thing the guide search finds: a page, or a heading at an anchor on it. */
export type GuideSearchEntry = {
	text: string;
	/** The page's title; the same as `text` for the page itself. */
	page: string;
	slug: string;
	anchor?: string;
};

// Match tiers, best first; within a tier a page outranks a heading.
function tier(text: string, query: string): number | undefined {
	if (text === query) {
		return 0;
	}

	if (text.startsWith(query)) {
		return 1;
	}

	if (text.includes(` ${query}`)) {
		return 2;
	}

	return text.includes(query) ? 3 : undefined;
}

/**
 * @description Lists what a guide tab's search covers: every page in sidebar order, then every h2 and h3.
 * @param guides The tab's guides.
 * @returns The entries.
 */
export function getGuideSearchEntries(guides: Guide[]): GuideSearchEntry[] {
	const pages = guides.map((guide) => ({
		text: guide.frontmatter.title,
		page: guide.frontmatter.title,
		slug: guide.slug,
	}));
	const headings = guides.flatMap((guide) =>
		guide.toc.map((heading) => ({
			text: heading.text,
			page: guide.frontmatter.title,
			slug: guide.slug,
			anchor: heading.slug,
		})),
	);

	return [...pages, ...headings];
}

/**
 * @description Finds the entries matching a search, best first: exact text, then prefixes, then word
 * starts, then substrings. In each tier pages come before headings; ties keep their order.
 * @param entries The entries to search, from {@link getGuideSearchEntries}.
 * @param query The search text; case-insensitive.
 * @param limit The most results to return.
 * @returns The matches.
 */
export function searchGuides(
	entries: GuideSearchEntry[],
	query: string,
	limit = 50,
): GuideSearchEntry[] {
	const needle = query.trim().toLowerCase();

	if (!needle) {
		return [];
	}

	return entries
		.flatMap((entry) => {
			const match = tier(entry.text.toLowerCase(), needle);

			return match === undefined
				? []
				: [{ entry, score: match * 2 + (entry.anchor ? 1 : 0) }];
		})
		.sort((a, b) => a.score - b.score)
		.slice(0, limit)
		.map(({ entry }) => entry);
}

export default { getGuideSearchEntries, searchGuides };
