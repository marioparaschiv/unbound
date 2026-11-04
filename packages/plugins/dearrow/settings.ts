import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	replaceElements: setting.choice({
		default: 'all',
		title: 'REPLACE',
		options: {
			all: 'REPLACE_ALL',
			titles: 'REPLACE_TITLES',
			thumbnails: 'REPLACE_THUMBNAILS',
		},
	}),
	dearrowByDefault: setting.boolean({
		default: true,
		title: 'DEARROW_BY_DEFAULT',
		subtitle: 'DEARROW_BY_DEFAULT_SUBTITLE',
	}),
	showToggle: setting.boolean({
		default: true,
		title: 'SHOW_TOGGLE',
		subtitle: 'SHOW_TOGGLE_SUBTITLE',
	}),
});
