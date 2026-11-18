import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	days: setting.integer({
		default: 30,
		min: 1,
		max: 3650,
		title: 'DAYS',
		subtitle: 'DAYS_SUBTITLE',
	}),
});
