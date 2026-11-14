import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	hidden: setting.string({ default: '', hidden: true }),
});
