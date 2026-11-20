import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	when: setting.choice({
		default: 'dark',
		title: 'WHEN',
		options: {
			dark: 'WHEN_DARK',
			night: 'WHEN_NIGHT',
			always: 'WHEN_ALWAYS',
		},
	}),
	nightStart: setting.integer({ default: 21, min: 0, max: 23, step: 1, title: 'NIGHT_START' }),
	nightEnd: setting.integer({ default: 7, min: 0, max: 23, step: 1, title: 'NIGHT_END' }),
	brightness: setting.integer({
		default: 70,
		min: 40,
		max: 95,
		step: 5,
		title: 'BRIGHTNESS',
		subtitle: 'BRIGHTNESS_SUBTITLE',
	}),
	dimUnknown: setting.boolean({
		default: false,
		title: 'DIM_UNKNOWN',
		subtitle: 'DIM_UNKNOWN_SUBTITLE',
	}),
	dim: setting.integer({
		default: 35,
		min: 10,
		max: 80,
		step: 5,
		title: 'DIM',
		subtitle: 'DIM_SUBTITLE',
	}),
});
