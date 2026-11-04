import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	theme: setting.string({
		default: 'dark-plus',
		title: 'THEME',
		subtitle: 'THEME_SUBTITLE',
	}),
	customTheme: setting.string({
		default: '',
		title: 'CUSTOM_THEME_URL',
		subtitle: 'CUSTOM_THEME_URL_SUBTITLE',
	}),
	bgOpacity: setting.integer({
		default: 100,
		min: 0,
		max: 100,
		title: 'BACKGROUND_OPACITY',
	}),
	useDevIcon: setting.choice({
		default: 'greyscale',
		title: 'LANGUAGE_ICONS',
		subtitle: 'LANGUAGE_ICONS_SUBTITLE',
		options: {
			disabled: 'ICONS_DISABLED',
			greyscale: 'ICONS_GREYSCALE',
			colored: 'ICONS_COLORED',
		},
	}),
	lineOverflow: setting.choice({
		default: 'wrap',
		title: 'LONG_LINES',
		subtitle: 'LONG_LINES_SUBTITLE',
		options: { wrap: 'LONG_LINES_WRAP', scroll: 'LONG_LINES_SCROLL' },
	}),
	tryHljs: setting.choice({
		default: 'secondary',
		title: 'HIGHLIGHTING_PREFERENCE',
		subtitle: 'HIGHLIGHTING_PREFERENCE_SUBTITLE',
		options: {
			never: 'HLJS_NEVER',
			secondary: 'HLJS_SECONDARY',
			primary: 'HLJS_PRIMARY',
			always: 'HLJS_ALWAYS',
		},
	}),
});
