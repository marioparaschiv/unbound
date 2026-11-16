import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	seconds: setting.integer({
		default: 5,
		min: 2,
		max: 30,
		title: 'SECONDS',
		subtitle: 'SECONDS_SUBTITLE',
	}),
});
