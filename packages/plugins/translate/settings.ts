import { defineSettings, setting } from '@unbound-app/settings/schema';

// The panel is custom, since the language pickers search a list; every setting is stored and typed only.
export default defineSettings({
	sourceLanguage: setting.string({ default: 'auto', hidden: true }),
	targetLanguage: setting.string({ default: 'en', hidden: true }),
	apiBaseUrl: setting.string({ default: 'https://translate.unbound.rip', hidden: true }),
	accessToken: setting.string({ default: '', hidden: true }),
	refreshToken: setting.string({ default: '', hidden: true }),
	expiresAt: setting.number({ default: 0, hidden: true }),
});
