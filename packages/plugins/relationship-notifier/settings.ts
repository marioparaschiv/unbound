import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		friends: setting.boolean({ default: true, title: 'FRIENDS', subtitle: 'FRIENDS_SUBTITLE' }),
		friendRequestCancels: setting.boolean({
			default: true,
			title: 'FRIEND_REQUESTS',
			subtitle: 'FRIEND_REQUESTS_SUBTITLE',
		}),
		servers: setting.boolean({ default: true, title: 'SERVERS', subtitle: 'SERVERS_SUBTITLE' }),
		groups: setting.boolean({ default: true, title: 'GROUPS', subtitle: 'GROUPS_SUBTITLE' }),
		offlineRemovals: setting.boolean({
			default: true,
			title: 'OFFLINE_REMOVALS',
			subtitle: 'OFFLINE_REMOVALS_SUBTITLE',
		}),
		notices: setting.boolean({
			default: false,
			title: 'NOTICES',
			subtitle: 'NOTICES_SUBTITLE',
		}),
	},
	{ title: 'NOTIFY_WHEN' },
);
