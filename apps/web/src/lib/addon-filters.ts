import type {
	AddonSort,
	FilterMatch,
	ListAddonsQuery,
	SingleMatch,
	SortOrder,
} from '@unbound-app/contracts/addons';

import type { AuthorOption } from '~/lib/authors/directory';
import type { TagOption } from '~/lib/addon-tags';

export type FilterField = 'tag' | 'author' | 'updated';

/** One condition, Linear style: a field, how it compares, and the picked values. */
export type AddonFilter = {
	field: FilterField;
	operator: FilterMatch;
	values: string[];
};

/** The listing query fields the filters write, as the URL and the API carry them. */
export type FilterSearch = Pick<
	NonNullable<ListAddonsQuery>,
	'tags' | 'tagMatch' | 'authors' | 'authorMatch' | 'updated' | 'updatedMatch'
>;

export type FilterOption = {
	value: string;
	label: string;
	/** A CSS color for a tag's dot, or `null` for an avatar or plain row. */
	color: string | null;
	avatarUrl: string | null;
	/** How many listed addons the option matches; `undefined` shows no count. */
	count?: number;
};

type FieldDefinition = {
	label: string;
	plural: string;
	/** Single-valued fields replace their value instead of toggling it. */
	multi: boolean;
	operators: FilterMatch[];
};

type SortDefinition = {
	value: AddonSort;
	label: string;
	/** Each sort carries its natural direction, as Linear's do: A to Z, newest first. */
	order: SortOrder;
};

/** How many authors one search page returns; skeletons render this many rows so nothing shifts. */
export const AUTHOR_PAGE_SIZE = 12;

export const FIELDS: Record<FilterField, FieldDefinition> = {
	tag: { label: 'Tags', plural: 'tags', multi: true, operators: ['any', 'all', 'none'] },
	author: { label: 'Author', plural: 'authors', multi: true, operators: ['any', 'none'] },
	updated: { label: 'Updated', plural: 'dates', multi: false, operators: ['any', 'none'] },
};

export const FIELD_ORDER: FilterField[] = ['tag', 'author', 'updated'];

/** The Updated field's choices, in days. */
export const UPDATED_WINDOWS: FilterOption[] = [
	{ value: '7', label: 'Last week', color: null, avatarUrl: null },
	{ value: '30', label: 'Last month', color: null, avatarUrl: null },
	{ value: '90', label: 'Last 3 months', color: null, avatarUrl: null },
	{ value: '365', label: 'Last year', color: null, avatarUrl: null },
];

/** The Sort menu's rows, in menu order. */
export const SORT_OPTIONS: SortDefinition[] = [
	{ value: 'name', label: 'Name', order: 'asc' },
	{ value: 'created', label: 'Release Date', order: 'desc' },
	{ value: 'updated', label: 'Recently Updated', order: 'desc' },
];

/**
 * @description Splits a comma-separated filter list, dropping repeats.
 * @param list The list, such as `privacy,voice`.
 * @returns The distinct values, or none for an absent list.
 */
export function splitList(list: string | undefined): string[] {
	return list ? [...new Set(list.split(','))] : [];
}

/**
 * @description Turns tags into menu rows, each with its dot and count.
 * @param tags The tags.
 * @returns The rows.
 */
export function tagOptions(tags: TagOption[]): FilterOption[] {
	return tags.map((tag) => ({
		value: tag.id,
		label: tag.label,
		color: tag.color,
		avatarUrl: null,
		count: tag.count,
	}));
}

/**
 * @description Turns authors into menu rows, each with its avatar and count.
 * @param authors The authors.
 * @returns The rows.
 */
export function authorOptions(authors: AuthorOption[]): FilterOption[] {
	return authors.map((author) => ({
		value: author.id,
		label: author.name,
		color: null,
		avatarUrl: author.avatarUrl,
		count: author.count,
	}));
}

/**
 * @description Looks up the direction a sort reads in.
 * @param sort The sort.
 * @returns Its order.
 */
export function sortOrder(sort: AddonSort): SortOrder {
	return SORT_OPTIONS.find((option) => option.value === sort)?.order ?? 'asc';
}

/**
 * @description Reads the filters a listing URL or query carries, in field order.
 * @param search The listing query.
 * @returns One filter per field with values.
 */
export function filtersFromSearch(search: FilterSearch): AddonFilter[] {
	const fields: [FilterField, string | undefined, FilterMatch | undefined][] = [
		['tag', search.tags, search.tagMatch],
		['author', search.authors, search.authorMatch],
		['updated', search.updated, search.updatedMatch],
	];

	return fields.flatMap(([field, list, operator = 'any']) => {
		const values = splitList(list);

		return values.length > 0 ? [{ field, operator, values }] : [];
	});
}

function paramsOf(filters: AddonFilter[], field: FilterField) {
	const filter = filters.find((candidate) => candidate.field === field);

	return {
		values: filter?.values.join(','),
		// `any` is the default, so it stays out of the URL.
		operator: filter?.operator === 'any' ? undefined : filter?.operator,
	};
}

// Author and Updated offer only `any` and `none`.
function single(operator: FilterMatch | undefined): SingleMatch | undefined {
	return operator === 'none' ? 'none' : undefined;
}

/**
 * @description Writes filters back as listing query fields; a field without a filter is cleared.
 * @param filters The filters.
 * @returns Every filter field, `undefined` where unset.
 */
export function searchFromFilters(filters: AddonFilter[]): FilterSearch {
	const tags = paramsOf(filters, 'tag');
	const authors = paramsOf(filters, 'author');
	const updated = paramsOf(filters, 'updated');

	return {
		tags: tags.values,
		tagMatch: tags.operator,
		authors: authors.values,
		authorMatch: single(authors.operator),
		updated: updated.values,
		updatedMatch: single(updated.operator),
	};
}

/**
 * @description Words the operator the way Linear does, which changes with how many values are picked.
 * @param filter The filter.
 * @returns The operator phrase, such as "is any of".
 */
export function operatorLabel({ field, operator, values }: AddonFilter): string {
	const many = values.length > 1;

	if (field === 'updated') {
		return operator === 'none' ? 'is not within' : 'is within';
	}

	if (operator === 'all') {
		return 'include all of';
	}

	if (operator === 'none') {
		return many ? 'is none of' : 'is not';
	}

	return many ? 'is any of' : 'is';
}

/**
 * @description Names an Updated value, which is a number of days.
 * @param days The stored value.
 * @returns The window's label, or the days spelled out for a value no window offers.
 */
export function windowLabel(days: string): string {
	return UPDATED_WINDOWS.find((window) => window.value === days)?.label ?? `${days} days`;
}

/**
 * @description Drops one field's filter.
 * @param filters The current filters.
 * @param field The field.
 * @returns The next filters.
 */
export function removeFilter(filters: AddonFilter[], field: FilterField): AddonFilter[] {
	return filters.filter((filter) => filter.field !== field);
}

/**
 * @description Adds or removes one value; a field with no values left drops its filter.
 * @param filters The current filters.
 * @param field The field the value belongs to.
 * @param value The value to toggle.
 * @returns The next filters.
 */
export function toggleFilterValue(
	filters: AddonFilter[],
	field: FilterField,
	value: string,
): AddonFilter[] {
	const existing = filters.find((filter) => filter.field === field);

	if (!existing) {
		return [...filters, { field, operator: 'any', values: [value] }];
	}

	const picked = existing.values.includes(value);
	const values = FIELDS[field].multi
		? picked
			? existing.values.filter((candidate) => candidate !== value)
			: [...existing.values, value]
		: picked
			? []
			: [value];

	if (values.length === 0) {
		return removeFilter(filters, field);
	}

	return filters.map((filter) => (filter === existing ? { ...filter, values } : filter));
}

/**
 * @description Changes how one field's filter compares.
 * @param filters The current filters.
 * @param field The field.
 * @param operator The new operator.
 * @returns The next filters.
 */
export function setFilterOperator(
	filters: AddonFilter[],
	field: FilterField,
	operator: FilterMatch,
): AddonFilter[] {
	return filters.map((filter) => (filter.field === field ? { ...filter, operator } : filter));
}

export default {
	AUTHOR_PAGE_SIZE,
	FIELDS,
	FIELD_ORDER,
	UPDATED_WINDOWS,
	SORT_OPTIONS,
	splitList,
	tagOptions,
	authorOptions,
	sortOrder,
	filtersFromSearch,
	searchFromFilters,
	operatorLabel,
	windowLabel,
	removeFilter,
	toggleFilterValue,
	setFilterOperator,
};
