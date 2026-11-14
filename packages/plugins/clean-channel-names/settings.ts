import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	spaces: setting.boolean({ default: true, title: 'SPACES', subtitle: 'SPACES_SUBTITLE' }),
	kept: setting.string({ default: '', hidden: true }),
});
