import { defineSettings, setting } from '@unbound-app/settings/schema';

// Every setting the developer guide's examples read or declare.
export default defineSettings({
	greetOnStart: setting.boolean({
		default: true,
		title: 'GREET_ON_START',
		subtitle: 'GREET_ON_START_SUBTITLE',
	}),
	duration: setting.integer({ default: 3, min: 1, max: 10, title: 'DURATION' }),
	theme: setting.choice({
		default: 'dark',
		title: 'THEME',
		options: { dark: 'THEME_DARK', light: 'THEME_LIGHT' },
	}),
	showBadge: setting.boolean({ default: true, title: 'SHOW_BADGE' }),
	memberList: setting.boolean({ default: true, title: 'MEMBER_LIST' }),
	emojiPicker: setting.boolean({ default: true, title: 'EMOJI_PICKER' }),
	style: setting.choice({
		default: 'roomy',
		title: 'STYLE',
		options: { compact: 'STYLE_COMPACT', roomy: 'STYLE_ROOMY' },
	}),
	locked: setting.boolean({ default: false, title: 'LOCKED' }),
	size: setting.integer({ default: 14, min: 10, max: 24, title: 'BADGE_SIZE' }),
	starred: setting.array({ of: setting.string(), default: [], title: 'STARRED_SETTING' }),
	appearance: setting.section(
		{ title: 'APPEARANCE' },
		{ accent: setting.string({ default: '#5865F2', title: 'ACCENT', displayAs: 'color' }) },
	),
	clear: setting.button({
		title: 'CLEAR_STARRED',
		action: 'clearStarred',
		displayAs: 'danger',
		confirm: 'CLEAR_CONFIRM',
	}),
	sizeWarning: setting.notice({
		title: 'SIZE_WARNING',
		subtitle: 'SIZE_WARNING_DETAIL',
		tone: 'warning',
		visibleWhen: (settings) => settings.size > 20,
	}),
});
