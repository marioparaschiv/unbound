import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	lightness: setting.integer({ default: 70, min: 0, max: 100, step: 5, title: 'LIGHTNESS' }),
	saturation: setting.integer({ default: 100, min: 0, max: 100, step: 5, title: 'SATURATION' }),
	seed: setting.string({
		default: '',
		title: 'SEED',
		subtitle: 'SEED_SUBTITLE',
		placeholder: 'SEED_PLACEHOLDER',
	}),
	onlyWithoutColor: setting.boolean({
		default: false,
		title: 'ONLY_WITHOUT_COLOR',
		subtitle: 'ONLY_WITHOUT_COLOR_SUBTITLE',
	}),
	onlyInDms: setting.boolean({
		default: false,
		title: 'ONLY_IN_DMS',
		subtitle: 'ONLY_IN_DMS_SUBTITLE',
	}),
});
