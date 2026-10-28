import type { MarketplaceAddon } from '~/lib/marketplace-addon';
import { getDefaultAvatarUrl } from '~/lib/discord';

export type FilterField = 'tag' | 'author' | 'updated';

export type FilterOperator = 'any' | 'all' | 'none';

/** One condition, Linear style: a field, how it compares, and the picked values. */
export type AddonFilter = {
	field: FilterField;
	operator: FilterOperator;
	values: string[];
};

export type AddonTag = {
	id: string;
	label: string;
	/** A Tailwind background class for the tag's dot. */
	color: string;
};

export type TaggedAddon = MarketplaceAddon & {
	tags: string[];
	updatedDaysAgo: number;
	createdDaysAgo: number;
	/** Every anonymous install ever logged. */
	installs: number;
	/** Installs logged in the last 7 days. */
	installsThisWeek: number;
};

export type FilterOption = {
	value: string;
	label: string;
	/** A Tailwind background class for a colour dot, or `null` for an avatar or plain row. */
	color: string | null;
	avatarUrl: string | null;
	count: number;
};

type FieldDefinition = {
	label: string;
	plural: string;
	/** Single-valued fields replace their value instead of toggling it. */
	multi: boolean;
	operators: FilterOperator[];
	options: (addons: TaggedAddon[]) => FilterOption[];
	matches: (addon: TaggedAddon, filter: AddonFilter) => boolean;
};

export type ListingSort = 'popular' | 'trending' | 'newest' | 'updated' | 'name';

type SortDefinition = {
	value: ListingSort;
	label: string;
	compare: (a: TaggedAddon, b: TaggedAddon) => number;
};

export type ListingQuery = {
	q: string;
	sort: ListingSort;
};

/** Each sort carries its natural direction, as Discord's and Linear's do: most first, newest first, A to Z. */
const SORTS: SortDefinition[] = [
	{ value: 'popular', label: 'Popular', compare: (a, b) => b.installs - a.installs },
	{
		value: 'trending',
		label: 'Trending',
		compare: (a, b) => b.installsThisWeek - a.installsThisWeek,
	},
	{
		value: 'newest',
		label: 'Release Date',
		compare: (a, b) => a.createdDaysAgo - b.createdDaysAgo,
	},
	{
		value: 'updated',
		label: 'Recently Updated',
		compare: (a, b) => a.updatedDaysAgo - b.updatedDaysAgo,
	},
	{ value: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
];

/** The sort menu's rows, in menu order. */
export const SORT_OPTIONS = SORTS.map(({ value, label }) => ({ value, label }));

export const TAGS: AddonTag[] = [
	{ id: 'appearance', label: 'Appearance', color: 'bg-violet-500' },
	{ id: 'messages', label: 'Messages', color: 'bg-sky-500' },
	{ id: 'privacy', label: 'Privacy', color: 'bg-emerald-500' },
	{ id: 'utility', label: 'Utility', color: 'bg-slate-400' },
	{ id: 'voice', label: 'Voice', color: 'bg-orange-500' },
	{ id: 'media', label: 'Media', color: 'bg-pink-500' },
	{ id: 'notifications', label: 'Notifications', color: 'bg-amber-500' },
	{ id: 'accessibility', label: 'Accessibility', color: 'bg-teal-500' },
	{ id: 'developer', label: 'Developer', color: 'bg-indigo-500' },
	{ id: 'fun', label: 'Fun', color: 'bg-rose-500' },
];

const TAG_BY_ID = new Map(TAGS.map((tag) => [tag.id, tag]));

const UPDATED_WINDOWS = [
	{ value: '7', label: 'Last week' },
	{ value: '30', label: 'Last month' },
	{ value: '90', label: 'Last 3 months' },
	{ value: '365', label: 'Last year' },
];

const AUTHORS = ['Mario', 'Ana', 'Kiwi', 'Rosie', 'Theo', 'Juno'];

type Seed = [name: string, description: string, tags: string[], author: number, updated: number];

const SEEDS: Seed[] = [
	[
		'Message Logger',
		'Keeps deleted and edited messages visible in chat.',
		['messages', 'privacy'],
		0,
		2,
	],
	[
		'Better Folders',
		'Open server folders in a sidebar of their own.',
		['appearance', 'utility'],
		1,
		12,
	],
	[
		'Silent Typing',
		'Hides your typing indicator from everyone else.',
		['privacy', 'messages'],
		2,
		40,
	],
	['Voice Volume Boost', 'Raise user volume past 200 percent.', ['voice', 'accessibility'], 3, 5],
	['Image Zoom', 'Scroll to zoom into images and avatars.', ['media', 'utility'], 4, 80],
	[
		'Translate',
		'Translate any message into your language in place.',
		['messages', 'accessibility'],
		5,
		20,
	],
	[
		'No Reply Mention',
		'Turns off reply pings by default.',
		['notifications', 'messages'],
		0,
		150,
	],
	['Font Loader', 'Use any Google font across the app.', ['appearance'], 1, 3],
	['Quiet Hours', 'Mute notifications on a schedule.', ['notifications', 'utility'], 2, 60],
	['Dev Inspector', 'Inspect stores, modules and props at runtime.', ['developer'], 3, 1],
	['Spotify Controls', 'Control your music from the voice panel.', ['media', 'voice'], 4, 220],
	['Party Mode', 'Confetti and screen shake while you type.', ['fun', 'appearance'], 5, 400],
	['Reveal Spoilers', 'Shows spoilers without the tap.', ['messages', 'accessibility'], 0, 33],
	['Fake Nitro Emojis', 'Send any emoji as a linked image.', ['fun', 'messages'], 1, 9],
	['Stream Preview', 'Hover a live stream to peek at it.', ['media', 'voice'], 2, 75],
	['Read All', 'Mark every server as read in one tap.', ['notifications', 'utility'], 3, 18],
	['Token Guard', 'Blocks scripts that try to read your token.', ['privacy', 'developer'], 4, 6],
	[
		'Reduced Motion',
		'Turns off avatars, stickers and emoji animation.',
		['accessibility', 'appearance'],
		5,
		110,
	],
	['Message Timestamps', 'Exact times beside every message.', ['messages'], 0, 290],
	['Console Shortcuts', 'Run snippets from a command palette.', ['developer', 'utility'], 1, 14],
	['Soundboard Plus', 'Unlimited local soundboard clips.', ['voice', 'fun'], 2, 48],
	['Hide Blocked', 'Removes blocked users from chat entirely.', ['privacy', 'messages'], 3, 27],
];

function slug(name: string) {
	return name.toLowerCase().replaceAll(/[^a-z]+/g, '-');
}

/** Fake listings with tags, standing in until tags exist in the manifest and database. */
export const TAGGED_ADDONS: TaggedAddon[] = SEEDS.map(
	([name, description, tags, author, updated], index) => ({
		id: `proto.${slug(name)}`,
		type: 'plugin',
		name,
		description,
		authors: [
			{
				kind: 'manifest',
				discordId: null,
				name: AUTHORS[author] ?? 'Unknown',
				avatarUrl: getDefaultAvatarUrl(String(BigInt(author + 1) << 22n)),
			},
		],
		version: `1.${index % 4}.${index % 7}`,
		manifestUrl: '',
		tags,
		updatedDaysAgo: updated,
		createdDaysAgo: updated + 30 + index * 11,
		// Scrambled so the all-time and weekly orders disagree, as real popular and trending lists do.
		installs: ((index * 7919) % 9000) + 120,
		installsThisWeek: ((index * 131) % 400) + 3,
	}),
);

function countBy(addons: TaggedAddon[], predicate: (addon: TaggedAddon) => boolean) {
	return addons.filter(predicate).length;
}

export const FIELDS: Record<FilterField, FieldDefinition> = {
	tag: {
		label: 'Tags',
		plural: 'tags',
		multi: true,
		operators: ['any', 'all', 'none'],
		/**
		 * @description Lists every tag with how many addons carry it.
		 * @param addons The addons to count.
		 * @returns The tag options.
		 */
		options: (addons) =>
			TAGS.map((tag) => ({
				value: tag.id,
				label: tag.label,
				color: tag.color,
				avatarUrl: null,
				count: countBy(addons, (addon) => addon.tags.includes(tag.id)),
			})),
		/**
		 * @description Tests an addon's tags against the filter.
		 * @param addon The addon.
		 * @param filter The tag filter.
		 * @returns Whether it matches.
		 */
		matches: (addon, filter) => {
			if (filter.operator === 'all') {
				return filter.values.every((value) => addon.tags.includes(value));
			}

			const hit = filter.values.some((value) => addon.tags.includes(value));

			return filter.operator === 'none' ? !hit : hit;
		},
	},
	author: {
		label: 'Author',
		plural: 'authors',
		multi: true,
		operators: ['any', 'none'],
		/**
		 * @description Lists each distinct author with how many addons they wrote.
		 * @param addons The addons to count.
		 * @returns The author options.
		 */
		options: (addons) =>
			[
				...new Map(
					addons.flatMap((addon) => addon.authors).map((a) => [a.name, a]),
				).values(),
			].map((author) => ({
				value: author.name,
				label: author.name,
				color: null,
				avatarUrl: author.avatarUrl,
				count: countBy(addons, (addon) =>
					addon.authors.some((candidate) => candidate.name === author.name),
				),
			})),
		/**
		 * @description Tests an addon's authors against the filter.
		 * @param addon The addon.
		 * @param filter The author filter.
		 * @returns Whether it matches.
		 */
		matches: (addon, filter) => {
			const hit = addon.authors.some((author) => filter.values.includes(author.name));

			return filter.operator === 'none' ? !hit : hit;
		},
	},
	updated: {
		label: 'Updated',
		plural: 'dates',
		multi: false,
		operators: ['any', 'none'],
		/**
		 * @description Lists the update windows with how many addons fall in each.
		 * @param addons The addons to count.
		 * @returns The window options.
		 */
		options: (addons) =>
			UPDATED_WINDOWS.map((window) => ({
				...window,
				color: null,
				avatarUrl: null,
				count: countBy(addons, (addon) => addon.updatedDaysAgo <= Number(window.value)),
			})),
		/**
		 * @description Tests when an addon was last updated against the filter.
		 * @param addon The addon.
		 * @param filter The updated filter.
		 * @returns Whether it matches.
		 */
		matches: (addon, filter) => {
			const within = addon.updatedDaysAgo <= Number(filter.values[0]);

			return filter.operator === 'none' ? !within : within;
		},
	},
};

export const FIELD_ORDER: FilterField[] = ['tag', 'author', 'updated'];

/**
 * @description Words the operator the way Linear does, which changes with how many values are picked.
 * @param filter The filter.
 * @returns The operator phrase, such as "is any of".
 */
export function operatorLabel({ field, operator, values }: AddonFilter): string {
	const many = values.length > 1;

	if (field === 'updated') {
		return operator === 'none' ? 'is before' : 'is within';
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
 * @description Names a field's value for display.
 * @param field The field.
 * @param value The stored value.
 * @returns Its label.
 */
export function valueLabel(field: FilterField, value: string): string {
	if (field === 'tag') {
		return TAG_BY_ID.get(value)?.label ?? value;
	}

	if (field === 'updated') {
		return UPDATED_WINDOWS.find((window) => window.value === value)?.label ?? value;
	}

	return value;
}

/**
 * @description Looks up a tag by id.
 * @param id The tag id.
 * @returns The tag, or `undefined` for an unknown id.
 */
export function getTag(id: string): AddonTag | undefined {
	return TAG_BY_ID.get(id);
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
	operator: FilterOperator,
): AddonFilter[] {
	return filters.map((filter) => (filter.field === field ? { ...filter, operator } : filter));
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
 * @description Applies the filters, the text search and the sort, the way the server would.
 * @param addons Every addon.
 * @param filters The filters, all of which must match.
 * @param query The text search and sort.
 * @returns The matching addons, sorted.
 */
export function applyFilters(
	addons: TaggedAddon[],
	filters: AddonFilter[],
	query: ListingQuery,
): TaggedAddon[] {
	const needle = query.q.trim().toLowerCase();
	const compare = SORTS.find((sort) => sort.value === query.sort)?.compare;
	const matching = addons.filter(
		(addon) =>
			(!needle ||
				addon.name.toLowerCase().includes(needle) ||
				addon.description.toLowerCase().includes(needle)) &&
			filters.every((filter) => FIELDS[filter.field].matches(addon, filter)),
	);

	return compare ? matching.toSorted(compare) : matching;
}

export default {
	TAGS,
	TAGGED_ADDONS,
	SORT_OPTIONS,
	FIELDS,
	FIELD_ORDER,
	operatorLabel,
	valueLabel,
	getTag,
	toggleFilterValue,
	setFilterOperator,
	removeFilter,
	applyFilters,
};
