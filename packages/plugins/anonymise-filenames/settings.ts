import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings({
	anonymiseByDefault: setting.boolean({
		default: true,
		title: 'ANONYMISE_BY_DEFAULT',
		subtitle: 'ANONYMISE_BY_DEFAULT_SUBTITLE',
	}),
	method: setting.choice({
		default: 'random',
		title: 'METHOD',
		options: {
			random: 'METHOD_RANDOM',
			consistent: 'METHOD_CONSISTENT',
			timestamp: 'METHOD_TIMESTAMP',
		},
	}),
	randomisedLength: setting.integer({
		default: 7,
		min: 1,
		max: 32,
		title: 'LENGTH',
		visibleWhen: (settings) => settings.method === 'random',
	}),
	consistent: setting.string({
		default: 'image',
		title: 'FILE_NAME',
		subtitle: 'FILE_NAME_SUBTITLE',
		visibleWhen: (settings) => settings.method === 'consistent',
	}),
});
