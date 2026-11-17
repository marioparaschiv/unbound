import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	playback: setting.choice({
		default: 'sound',
		title: 'PLAYBACK',
		subtitle: 'PLAYBACK_SUBTITLE',
		displayAs: 'segmented',
		options: { sound: 'SOUND', vibration: 'VIBRATION', both: 'BOTH' },
	}),
	speed: setting.integer({
		default: 15,
		title: 'SPEED',
		subtitle: 'SPEED_SUBTITLE',
		min: 5,
		max: 30,
		step: 1,
	}),
});
