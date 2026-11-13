import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	backgroundCheck: setting.boolean({
		default: false,
		title: 'BACKGROUND_CHECK',
		subtitle: 'BACKGROUND_CHECK_SUBTITLE',
	}),
	checkInterval: setting.integer({
		default: 20,
		min: 1,
		max: 120,
		title: 'CHECK_INTERVAL',
		visibleWhen: (settings) => settings.backgroundCheck,
	}),
});
