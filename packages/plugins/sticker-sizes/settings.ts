import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	scale: setting.choice({
		default: '75',
		title: 'SCALE',
		subtitle: 'SCALE_SUBTITLE',
		displayAs: 'segmented',
		options: { '50': 'SCALE_50', '75': 'SCALE_75', '125': 'SCALE_125', '150': 'SCALE_150' },
	}),
});
