import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		radius: setting.integer({
			default: 8,
			min: 0,
			max: 64,
			title: 'CORNER_RADIUS',
			subtitle: 'CORNER_RADIUS_SUBTITLE',
		}),
	},
	{ title: 'AVATARS' },
);
