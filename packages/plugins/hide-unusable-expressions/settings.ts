import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	emojis: setting.boolean({ default: true, title: 'EMOJIS', subtitle: 'EMOJIS_SUBTITLE' }),
	stickers: setting.boolean({ default: true, title: 'STICKERS', subtitle: 'STICKERS_SUBTITLE' }),
});
