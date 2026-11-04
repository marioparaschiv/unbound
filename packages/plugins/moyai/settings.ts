import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		allowReactions: setting.boolean({
			default: true,
			title: 'PLAY_ON_REACTIONS',
			subtitle: 'PLAY_ON_REACTIONS_SUBTITLE',
		}),
	},
	{ title: 'GENERAL' },
);
