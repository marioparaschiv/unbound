import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	count: setting.integer({
		default: 1,
		min: 1,
		max: 10,
		title: 'COUNT',
		subtitle: 'COUNT_SUBTITLE',
	}),
	output: setting.choice({
		default: 'share',
		title: 'OUTPUT',
		subtitle: 'OUTPUT_SUBTITLE',
		options: { share: 'OUTPUT_SHARE', copy: 'OUTPUT_COPY' },
	}),
});
