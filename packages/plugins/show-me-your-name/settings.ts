import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		mode: setting.choice({
			default: 'nick-user',
			title: 'DISPLAY_MODE',
			options: {
				'nick-user': { title: 'MODE_NICK_USER', subtitle: 'MODE_NICK_USER_SUBTITLE' },
				'user-nick': { title: 'MODE_USER_NICK', subtitle: 'MODE_USER_NICK_SUBTITLE' },
				user: { title: 'MODE_USER', subtitle: 'MODE_USER_SUBTITLE' },
			},
		}),
		friendNicknames: setting.boolean({
			default: true,
			title: 'FRIEND_NICKNAMES',
			subtitle: 'FRIEND_NICKNAMES_SUBTITLE',
		}),
		displayNames: setting.boolean({
			default: false,
			title: 'DISPLAY_NAMES',
			subtitle: 'DISPLAY_NAMES_SUBTITLE',
		}),
		inReplies: setting.boolean({
			default: false,
			title: 'IN_REPLIES',
			subtitle: 'IN_REPLIES_SUBTITLE',
		}),
	},
	{ title: 'PREFERENCES' },
);
