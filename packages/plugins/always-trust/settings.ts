import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	domain: setting.boolean({ default: true, title: 'DOMAIN', subtitle: 'DOMAIN_SUBTITLE' }),
	file: setting.boolean({ default: true, title: 'FILE', subtitle: 'FILE_SUBTITLE' }),
});
