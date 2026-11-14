import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		system: setting.choice({
			title: 'CONVERT_TO',
			subtitle: 'CONVERT_TO_SUBTITLE',
			default: 'auto',
			options: {
				auto: { title: 'SYSTEM_AUTO', subtitle: 'SYSTEM_AUTO_SUBTITLE' },
				metric: { title: 'SYSTEM_METRIC', subtitle: 'SYSTEM_METRIC_SUBTITLE' },
				imperial: { title: 'SYSTEM_IMPERIAL', subtitle: 'SYSTEM_IMPERIAL_SUBTITLE' },
				both: { title: 'SYSTEM_BOTH', subtitle: 'SYSTEM_BOTH_SUBTITLE' },
			},
		}),
	},
	{ title: 'CONVERSIONS' },
);
