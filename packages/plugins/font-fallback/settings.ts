import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	choices: setting.string({ default: '{}', hidden: true }),
});
