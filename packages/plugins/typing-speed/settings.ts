import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	live: setting.boolean({ default: true, title: 'LIVE', subtitle: 'LIVE_SUBTITLE' }),
	messages: setting.integer({ default: 0, hidden: true }),
	totalWpm: setting.integer({ default: 0, hidden: true }),
	bestWpm: setting.integer({ default: 0, hidden: true }),
	reset: setting.button({
		title: 'RESET',
		action: 'resetStats',
		confirm: 'RESET_CONFIRM',
		displayAs: 'danger',
	}),
});
