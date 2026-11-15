import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	order: setting.string({ default: '', hidden: true }),
	hidden: setting.string({ default: '', hidden: true }),
	seen: setting.string({ default: '', hidden: true }),
});
