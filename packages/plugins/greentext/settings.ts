import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	color: setting.string({ default: '', hidden: true }),
});
