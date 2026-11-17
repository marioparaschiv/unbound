import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	voiceChannels: setting.boolean({
		default: true,
		title: 'VOICE_CHANNELS',
		subtitle: 'VOICE_CHANNELS_SUBTITLE',
	}),
	calls: setting.boolean({ default: true, title: 'CALLS', subtitle: 'CALLS_SUBTITLE' }),
});
