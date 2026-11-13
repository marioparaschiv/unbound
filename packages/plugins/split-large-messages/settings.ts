import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	maxParts: setting.integer({
		default: 5,
		min: 2,
		max: 20,
		title: 'MAX_PARTS',
		subtitle: 'MAX_PARTS_SUBTITLE',
	}),
});
