import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	sendAudio: setting.boolean({
		default: true,
		title: 'SEND_AUDIO',
		subtitle: 'SEND_AUDIO_SUBTITLE',
	}),
	speed: setting.choice({
		default: '1',
		title: 'SPEED',
		subtitle: 'SPEED_SUBTITLE',
		displayAs: 'segmented',
		options: {
			'0.75': 'SPEED_075',
			'1': 'SPEED_1',
			'1.5': 'SPEED_15',
			'2': 'SPEED_2',
		},
	}),
	showAudio: setting.boolean({
		default: false,
		title: 'SHOW_AUDIO',
		subtitle: 'SHOW_AUDIO_SUBTITLE',
	}),
});
