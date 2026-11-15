import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	dim: setting.number({
		default: 55,
		min: 0,
		max: 90,
		step: 5,
		title: 'DIM',
		subtitle: 'DIM_SUBTITLE',
	}),
});
