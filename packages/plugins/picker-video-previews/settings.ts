import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	sound: setting.boolean({ default: false, title: 'SOUND', subtitle: 'SOUND_SUBTITLE' }),
});
