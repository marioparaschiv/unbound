import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	presets: setting.string({ default: '[]', hidden: true }),
});
