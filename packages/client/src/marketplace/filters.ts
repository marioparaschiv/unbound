import type { AddonAuthor, AddonKind } from '@unbound-app/types/addons';
import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { Tag } from '@unbound-app/contracts/tags';

import type { CatalogSort } from '~/marketplace/catalog';

/** `any` keeps the addons a filter's values match; `none` keeps the rest, as the website's filters do. */
export type FilterMatch = 'any' | 'none';

/** Tags also take `all`, keeping the addons that carry every picked tag. */
export type TagMatch = FilterMatch | 'all';

/** How the marketplace page sorts and narrows a tab beyond its search. */
export type MarketplaceFilters = {
	sort: CatalogSort;
	/** Ids of the tags to match; empty filters nothing. */
	tags: string[];
	tagMatch: TagMatch;
	/** Discord ids of the authors to keep or drop; empty filters nothing. */
	authors: string[];
	authorMatch: FilterMatch;
	/** Keeps addons published within this many days, or drops them with `none`; `null` is any time. */
	updated: number | null;
	updatedMatch: FilterMatch;
};

/** One author the filter offers, with how many addons of the tab list them. */
export type AuthorOption = {
	id: AddonAuthor['id'];
	name: string;
	count: number;
};

/** One tag the filter offers, with how many addons of the tab carry it. */
export type TagOption = Tag & { count: number };

/** The operators of the Authors and Updated filters, in segment order. */
export const FILTER_MATCHES: readonly FilterMatch[] = ['any', 'none'];

/** The Tags filter's operators, in segment order, as the website offers them. */
export const TAG_MATCHES: readonly TagMatch[] = ['any', 'all', 'none'];

/** The Updated filter's windows, in days, as the website offers them. */
export const UPDATED_WINDOWS = [7, 30, 90, 365] as const;

export const DEFAULT_FILTERS: MarketplaceFilters = {
	sort: 'popular',
	tags: [],
	tagMatch: 'any',
	authors: [],
	authorMatch: 'any',
	updated: null,
	updatedMatch: 'any',
};

/** A kind with fewer listed addons shows no shelf, since it would only repeat the list below it. */
const FEATURED_MIN_LISTED = 8;
const FEATURED_LIMIT = 10;
const DAY_MS = 86_400_000;

/**
 * @description Counts the filters that narrow the list; the sort narrows nothing.
 * @param filters The page's filters.
 * @returns 0 to 3.
 */
export function countActiveFilters(filters: MarketplaceFilters): number {
	return (
		Number(filters.tags.length > 0) +
		Number(filters.authors.length > 0) +
		Number(filters.updated !== null)
	);
}

// `any` keeps an addon carrying one picked tag, `all` one carrying every picked tag, `none` one carrying none.
function matchesTags(addon: ListedAddon, picked: Set<string>, match: TagMatch): boolean {
	const carried = (addon.tags ?? []).filter((tag) => picked.has(tag.id)).length;

	switch (match) {
		case 'all':
			return carried === picked.size;
		case 'none':
			return carried === 0;
		default:
			return carried > 0;
	}
}

/**
 * @description Narrows listed addons by their tags, their authors and when their newest version was published.
 * @param addons The addons, already searched and sorted; their order is kept.
 * @param filters The page's filters.
 * @param now The current time in milliseconds, which the Updated window counts back from.
 * @returns The addons every filter keeps.
 */
export function filterCatalog(
	addons: ListedAddon[],
	filters: MarketplaceFilters,
	now: number,
): ListedAddon[] {
	const tags = new Set(filters.tags);
	const authors = new Set(filters.authors);
	const cutoff = filters.updated === null ? undefined : now - filters.updated * DAY_MS;

	return addons.filter((addon) => {
		const { manifest, publishedAt } = addon.latestVersion;

		if (tags.size > 0 && !matchesTags(addon, tags, filters.tagMatch)) {
			return false;
		}

		if (authors.size > 0) {
			const listed = manifest.authors.some((author) => authors.has(author.id));

			if (listed !== (filters.authorMatch === 'any')) {
				return false;
			}
		}

		if (cutoff !== undefined) {
			const recent = Date.parse(publishedAt) >= cutoff;

			if (recent !== (filters.updatedMatch === 'any')) {
				return false;
			}
		}

		return true;
	});
}

/**
 * @description Lists every author of one kind's addons, the most prolific first.
 * @param addons The catalog's addons.
 * @param type The tab's kind.
 * @returns One option per Discord id, named as its first listing names it.
 */
export function listAuthors(addons: ListedAddon[], type: AddonKind): AuthorOption[] {
	const options = new Map<string, AuthorOption>();

	for (const addon of addons) {
		if (addon.type !== type) {
			continue;
		}

		for (const { id, name } of addon.latestVersion.manifest.authors) {
			const option = options.get(id) ?? { id, name, count: 0 };

			option.count += 1;
			options.set(id, option);
		}
	}

	return [...options.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * @description Lists every tag of one kind's addons, the most used first.
 * @param addons The catalog's addons.
 * @param type The tab's kind.
 * @returns One option per tag id; none when the catalog carries no tags.
 */
export function listTags(addons: ListedAddon[], type: AddonKind): TagOption[] {
	const options = new Map<string, TagOption>();

	for (const addon of addons) {
		if (addon.type !== type) {
			continue;
		}

		for (const tag of addon.tags ?? []) {
			const option = options.get(tag.id) ?? { ...tag, count: 0 };

			option.count += 1;
			options.set(tag.id, option);
		}
	}

	return [...options.values()].sort(
		(a, b) => b.count - a.count || a.label.localeCompare(b.label),
	);
}

// FNV-1a: a stable, well-spread order for one day's picks without shipping a PRNG.
function hash(text: string): number {
	let value = 2166136261;

	for (let index = 0; index < text.length; index++) {
		value = Math.imul(value ^ text.charCodeAt(index), 16777619);
	}

	return value >>> 0;
}

/**
 * @description Picks the addons the Featured shelf shows: those whose maintainers chose an icon, in an
 * order that changes once a day, so every polished addon gets its turn.
 * @param addons The catalog's addons.
 * @param type The tab's kind.
 * @param now The current time in milliseconds; picks change at midnight UTC.
 * @returns Up to ten addons, or none when the kind lists too few for a shelf to add anything.
 */
export function pickFeatured(addons: ListedAddon[], type: AddonKind, now: number): ListedAddon[] {
	const listed = addons.filter((addon) => addon.type === type);

	if (listed.length < FEATURED_MIN_LISTED) {
		return [];
	}

	const day = Math.floor(now / DAY_MS);
	const iconed = listed.filter((addon) => addon.iconSvg);
	const pool = iconed.length >= FEATURED_MIN_LISTED ? iconed : listed;

	return pool
		.map((addon) => ({ addon, rank: hash(`${day}:${addon.id}`) }))
		.sort((a, b) => a.rank - b.rank)
		.slice(0, FEATURED_LIMIT)
		.map(({ addon }) => addon);
}

export default {
	countActiveFilters,
	filterCatalog,
	listAuthors,
	listTags,
	pickFeatured,
};
