import type { SettingsEntry } from '@unbound-app/settings';

export const FORUM_LAYOUTS: Record<SettingsEntry<'defaultLayout'>, number> = {
	list: 1,
	gallery: 2,
};

export const THREAD_SORT_ORDERS: Record<SettingsEntry<'defaultSortOrder'>, number> = {
	recentlyActive: 0,
	datePosted: 1,
};
