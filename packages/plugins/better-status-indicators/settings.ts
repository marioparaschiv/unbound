import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	keepDot: setting.boolean({ default: false, title: 'KEEP_DOT', subtitle: 'KEEP_DOT_SUBTITLE' }),
	thickness: setting.number({
		default: 2,
		min: 1,
		max: 4,
		step: 1,
		title: 'THICKNESS',
		subtitle: 'THICKNESS_SUBTITLE',
	}),
	offline: setting.boolean({ default: false, title: 'OFFLINE', subtitle: 'OFFLINE_SUBTITLE' }),
});
