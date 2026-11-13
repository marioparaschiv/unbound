import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	keywords: setting.array({
		title: 'KEYWORDS',
		subtitle: 'KEYWORDS_SUBTITLE',
		of: setting.string(),
	}),
	regex: setting.boolean({ default: false, title: 'REGEX', subtitle: 'REGEX_SUBTITLE' }),
	caseSensitive: setting.boolean({ default: false, title: 'CASE_SENSITIVE' }),
	wholeWords: setting.boolean({ default: true, title: 'WHOLE_WORDS' }),
	ignoreBots: setting.boolean({ default: true, title: 'IGNORE_BOTS' }),
	ignoreUsers: setting.string({ default: '', hidden: true }),
	ignoreChannels: setting.string({ default: '', hidden: true }),
	ignoreGuilds: setting.string({ default: '', hidden: true }),
});
