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
	showSelf: setting.boolean({ default: true, title: 'SHOW_FOR_YOURSELF' }),
});
