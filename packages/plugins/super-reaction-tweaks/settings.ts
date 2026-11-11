import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		superReactByDefault: setting.boolean({
			default: true,
			title: 'SUPER_REACT_BY_DEFAULT',
			subtitle: 'SUPER_REACT_BY_DEFAULT_SUBTITLE',
		}),
		// The maximum is Discord's own limit, `DISCORD_PLAYING_LIMIT` in src/constants.ts.
		superReactionPlayingLimit: setting.integer({
			default: 5,
			min: 0,
			max: 5,
			title: 'PLAYING_LIMIT',
			subtitle: 'PLAYING_LIMIT_SUBTITLE',
		}),
	},
	{ title: 'SUPER_REACTIONS' },
);
