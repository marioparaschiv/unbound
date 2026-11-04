export const PLUGIN_NAME = 'Override Forum Defaults';

export const CHANNEL_RECORD_PATH = 'records/ChannelRecord.tsx';

export const FORUM_LAYOUTS = {
	list: 1,
	gallery: 2,
} as const;

export const THREAD_SORT_ORDERS = {
	recentlyActive: 0,
	datePosted: 1,
} as const;

export type LayoutChoice = keyof typeof FORUM_LAYOUTS;

export type SortOrderChoice = keyof typeof THREAD_SORT_ORDERS;

export const SETTINGS: {
	defaultLayout: LayoutChoice;
	defaultSortOrder: SortOrderChoice;
} = {
	defaultLayout: 'list',
	defaultSortOrder: 'recentlyActive',
};
