import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	sendAudio: setting.boolean({
		default: true,
		title: 'SEND_AUDIO',
		subtitle: 'SEND_AUDIO_SUBTITLE',
	}),
	speed: setting.choice({
		default: '1.0',
		title: 'SPEED',
		subtitle: 'SPEED_SUBTITLE',
		displayAs: 'segmented',
		options: {
			'0.75': 'SPEED_075',
			'1.0': 'SPEED_1',
			'1.5': 'SPEED_15',
			'2.0': 'SPEED_2',
		},
	}),
	perChat: setting.boolean({
		default: true,
		title: 'PER_CHAT',
		subtitle: 'PER_CHAT_SUBTITLE',
	}),
	autoplay: setting.boolean({
		default: true,
		title: 'AUTOPLAY',
		subtitle: 'AUTOPLAY_SUBTITLE',
	}),
	showAudio: setting.boolean({
		default: false,
		title: 'SHOW_AUDIO',
		subtitle: 'SHOW_AUDIO_SUBTITLE',
	}),
});
