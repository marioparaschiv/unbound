import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	seconds: setting.integer({
		default: 3,
		min: 1,
		max: 60,
		title: 'SECONDS',
		subtitle: 'SECONDS_SUBTITLE',
	}),
	attachments: setting.boolean({
		default: false,
		title: 'ATTACHMENTS',
		subtitle: 'ATTACHMENTS_SUBTITLE',
	}),
	space: setting.boolean({ default: false, title: 'SPACE', subtitle: 'SPACE_SUBTITLE' }),
});
