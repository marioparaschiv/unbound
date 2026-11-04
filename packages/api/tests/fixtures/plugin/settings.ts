import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	greetOnStart: setting.boolean({
		default: true,
		title: 'GREET_ON_START',
		subtitle: 'GREET_ON_START_SUBTITLE',
	}),
	appearance: setting.section(
		{ title: 'APPEARANCE' },
		{
			size: setting.integer({ default: 14, min: 10, max: 24, title: 'SIZE' }),
			accent: setting.string({ default: '#5865f2', displayAs: 'color', title: 'ACCENT' }),
		},
	),
});
