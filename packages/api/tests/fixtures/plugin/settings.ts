import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	greetOnStart: setting.boolean({
		default: true,
		title: 'GREET_ON_START',
		subtitle: 'GREET_ON_START_SUBTITLE',
	}),
	sizeNotice: setting.notice({
		title: 'SIZE_NOTICE',
		subtitle: 'SIZE_NOTICE_SUBTITLE',
		tone: 'warning',
		visibleWhen: (settings) => settings.appearance.size > 20,
	}),
	debug: setting.boolean({ default: false, hidden: true }),
	appearance: setting.section(
		{ title: 'APPEARANCE' },
		{
			size: setting.integer({ default: 14, min: 10, max: 24, title: 'SIZE' }),
			accent: setting.string({
				default: '#5865f2',
				displayAs: 'color',
				title: 'ACCENT',
				disabledWhen: 'greetOnStart',
			}),
			resetAccent: setting.button({ title: 'RESET_ACCENT', action: 'resetAccent' }),
		},
	),
});
