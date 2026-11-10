import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		channelToAffect: setting.choice({
			default: 'both_dms',
			title: 'DMS_TO_AFFECT',
			options: {
				both_dms: 'BOTH_DMS',
				user_dm: 'USER_DMS',
				group_dm: 'GROUP_DMS',
			},
		}),
		allowMentions: setting.boolean({
			default: false,
			title: 'ALLOW_MENTIONS',
			subtitle: 'ALLOW_MENTIONS_SUBTITLE',
		}),
		allowEveryone: setting.boolean({
			default: false,
			title: 'ALLOW_EVERYONE',
			subtitle: 'ALLOW_EVERYONE_SUBTITLE',
		}),
	},
	{ title: 'ONE_PING_PER_DM' },
);
