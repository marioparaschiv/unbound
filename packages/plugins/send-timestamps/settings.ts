import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	replace: setting.boolean({ default: true, title: 'REPLACE', subtitle: 'REPLACE_SUBTITLE' }),
});
