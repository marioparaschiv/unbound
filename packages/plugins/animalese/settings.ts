import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	voice: setting.choice({
		default: 'person',
		title: 'VOICE',
		subtitle: 'VOICE_SUBTITLE',
		displayAs: 'picker',
		options: { person: 'PERSON', low: 'LOW', mid: 'MID', high: 'HIGH', squeaky: 'SQUEAKY' },
	}),
	speed: setting.integer({
		default: 70,
		title: 'SPEED',
		subtitle: 'SPEED_SUBTITLE',
		min: 40,
		max: 140,
		step: 10,
	}),
	volume: setting.number({ default: 0.6, title: 'VOLUME', min: 0.1, max: 1, step: 0.1 }),
	maxLetters: setting.integer({
		default: 40,
		title: 'MAX_LETTERS',
		subtitle: 'MAX_LETTERS_SUBTITLE',
		min: 5,
		max: 200,
		step: 5,
	}),
	cooldown: setting.integer({
		default: 2000,
		title: 'COOLDOWN',
		subtitle: 'COOLDOWN_SUBTITLE',
		displayAs: 'duration',
		units: ['s'],
		min: 0,
	}),
	own: setting.boolean({ default: false, title: 'OWN', subtitle: 'OWN_SUBTITLE' }),
	bots: setting.boolean({ default: false, title: 'BOTS' }),
});
