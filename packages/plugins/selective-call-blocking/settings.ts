import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	users: setting.string({ default: '', hidden: true }),
	groups: setting.string({ default: '', hidden: true }),
});
