import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	format: setting.choice({
		default: 'lowercase',
		title: 'PRONOUNS',
		options: { lowercase: 'FORMAT_LOWERCASE', capitalized: 'FORMAT_CAPITALIZED' },
	}),
	priority: setting.choice({
		default: 'pronoundb',
		title: 'SOURCE',
		options: {
			pronoundb: { title: 'SOURCE_PRONOUNDB', subtitle: 'SOURCE_PRONOUNDB_SUBTITLE' },
			discord: { title: 'SOURCE_DISCORD', subtitle: 'SOURCE_DISCORD_SUBTITLE' },
		},
	}),
	style: setting.choice({
		default: 'text',
		title: 'STYLE',
		displayAs: 'segmented',
		options: { text: 'STYLE_TEXT', pill: 'STYLE_PILL', custom: 'STYLE_CUSTOM' },
	}),
	pillColor: setting.string({
		default: '#5865F2',
		title: 'PILL_COLOR',
		subtitle: 'PILL_COLOR_SUBTITLE',
		displayAs: 'color',
		visibleWhen: (settings) => settings.style === 'custom',
	}),
	showSelf: setting.boolean({ default: true, title: 'SHOW_FOR_YOURSELF' }),
});
