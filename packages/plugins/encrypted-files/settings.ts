import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	publicKey: setting.string({ default: '', hidden: true }),
	secretKey: setting.string({ default: '', hidden: true }),
	contacts: setting.string({ default: '{}', hidden: true }),
	channels: setting.string({ default: '', hidden: true }),
});
