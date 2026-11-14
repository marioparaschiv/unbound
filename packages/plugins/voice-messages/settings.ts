import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	sendAudio: setting.boolean({
		default: true,
		title: 'SEND_AUDIO',
		subtitle: 'SEND_AUDIO_SUBTITLE',
	}),
	showAudio: setting.boolean({
		default: false,
		title: 'SHOW_AUDIO',
		subtitle: 'SHOW_AUDIO_SUBTITLE',
	}),
});
