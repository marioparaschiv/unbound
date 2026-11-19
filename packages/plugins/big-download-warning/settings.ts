import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	threshold: setting.integer({
		default: 20,
		title: 'THRESHOLD',
		subtitle: 'THRESHOLD_SUBTITLE',
		min: 5,
		max: 500,
		step: 5,
	}),
});
