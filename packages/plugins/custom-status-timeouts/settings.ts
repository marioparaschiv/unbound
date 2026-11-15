import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	durations: setting.string({
		default: '15m, 2h, 8h, 12h, 3d, 7d',
		title: 'DURATIONS',
		subtitle: 'DURATIONS_SUBTITLE',
	}),
});
