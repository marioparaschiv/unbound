import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	scale: setting.number({
		default: 115,
		min: 50,
		max: 200,
		step: 5,
		title: 'SCALE',
		subtitle: 'SCALE_SUBTITLE',
	}),
});
