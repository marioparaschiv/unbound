import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	defaultLayout: setting.choice({
		default: 'list',
		title: 'DEFAULT_LAYOUT',
		options: {
			list: { title: 'LAYOUT_LIST', subtitle: 'LAYOUT_LIST_SUBTITLE' },
			gallery: { title: 'LAYOUT_GALLERY', subtitle: 'LAYOUT_GALLERY_SUBTITLE' },
		},
	}),
	defaultSortOrder: setting.choice({
		default: 'recentlyActive',
		title: 'DEFAULT_SORT_ORDER',
		options: {
			recentlyActive: {
				title: 'SORT_RECENTLY_ACTIVE',
				subtitle: 'SORT_RECENTLY_ACTIVE_SUBTITLE',
			},
			datePosted: { title: 'SORT_DATE_POSTED', subtitle: 'SORT_DATE_POSTED_SUBTITLE' },
		},
	}),
});
