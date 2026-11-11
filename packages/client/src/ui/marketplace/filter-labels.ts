import type { AuthorOption, MarketplaceFilters, TagOption } from '~/marketplace/filters';
import type { CatalogSort } from '~/marketplace/catalog';
import { messages, format } from '~/i18n/api';

/** The sort sheet's rows, in order. */
export const SORTS: CatalogSort[] = ['name', 'popular', 'updated'];

const SORT_LABELS: Record<CatalogSort, () => string> = {
	name: () => messages.UNBOUND_SORT_NAME,
	popular: () => messages.UNBOUND_SORT_POPULAR,
	updated: () => messages.UNBOUND_SORT_UPDATED,
};

/**
 * @description Names a sort.
 * @param sort The sort.
 * @returns Its label, such as "Recently updated".
 */
export function sortLabel(sort: CatalogSort): string {
	return SORT_LABELS[sort]();
}

/**
 * @description Names an Updated window.
 * @param days The window in days.
 * @returns Its label, such as "1 month", or the days spelled out for a window the sheet does not offer.
 */
export function windowLabel(days: number): string {
	switch (days) {
		case 7:
			return messages.UNBOUND_FILTER_WEEK;
		case 30:
			return messages.UNBOUND_FILTER_MONTH;
		case 90:
			return messages.UNBOUND_FILTER_3_MONTHS;
		case 365:
			return messages.UNBOUND_FILTER_YEAR;
		default:
			return `${days}d`;
	}
}

/**
 * @description Sums up the Tags filter: the first picked label, how many more, and how they match.
 * @param filters The page's filters.
 * @param options The tab's tags, which label the picked ids.
 * @returns The summary, such as "Chat +2", "all of Chat +1" or "not Chat", or `undefined` when no tag is picked.
 */
export function tagsSummary(filters: MarketplaceFilters, options: TagOption[]): string | undefined {
	const [first, ...rest] = filters.tags;

	if (first === undefined) {
		return undefined;
	}

	const label = options.find((option) => option.id === first)?.label ?? first;
	const value = rest.length ? `${label} +${rest.length}` : label;

	switch (filters.tagMatch) {
		case 'none':
			return format('UNBOUND_FILTER_NOT', { value });
		case 'all':
			return rest.length ? format('UNBOUND_FILTER_ALL_OF', { value }) : value;
		default:
			return value;
	}
}

/**
 * @description Sums up the Authors filter: the first picked name, how many more, and whether they are excluded.
 * @param filters The page's filters.
 * @param options The tab's authors, which name the picked ids.
 * @returns The summary, such as "V +2" or "not V", or `undefined` when no author is picked.
 */
export function authorsSummary(
	filters: MarketplaceFilters,
	options: AuthorOption[],
): string | undefined {
	const [first, ...rest] = filters.authors;

	if (first === undefined) {
		return undefined;
	}

	const name = options.find((option) => option.id === first)?.name ?? first;
	const value = rest.length ? `${name} +${rest.length}` : name;

	return filters.authorMatch === 'none' ? format('UNBOUND_FILTER_NOT', { value }) : value;
}

/**
 * @description Sums up the Updated filter.
 * @param filters The page's filters.
 * @returns The summary, such as "within 1 month", or `undefined` for any time.
 */
export function updatedSummary(filters: MarketplaceFilters): string | undefined {
	if (filters.updated === null) {
		return undefined;
	}

	const value = windowLabel(filters.updated);

	return filters.updatedMatch === 'none'
		? format('UNBOUND_FILTER_OLDER_THAN', { value })
		: format('UNBOUND_FILTER_WITHIN_VALUE', { value });
}
