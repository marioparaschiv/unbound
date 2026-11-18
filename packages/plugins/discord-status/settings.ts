import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	minor: setting.boolean({ default: false, title: 'MINOR', subtitle: 'MINOR_SUBTITLE' }),
	announced: setting.string({ default: '', hidden: true }),
});
