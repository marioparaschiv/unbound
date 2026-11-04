import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		colorEffects: setting.boolean({
			default: true,
			title: 'COLOR_THRESHOLDS',
			subtitle: 'COLOR_THRESHOLDS_SUBTITLE',
		}),
	},
	{ title: 'APPEARANCE' },
);
