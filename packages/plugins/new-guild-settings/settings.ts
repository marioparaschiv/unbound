import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		guild: setting.boolean({
			default: true,
			title: 'MUTE_SERVER',
			subtitle: 'MUTE_SERVER_SUBTITLE',
		}),
		everyone: setting.boolean({
			default: true,
			title: 'SUPPRESS_EVERYONE',
			subtitle: 'SUPPRESS_EVERYONE_SUBTITLE',
		}),
		role: setting.boolean({
			default: true,
			title: 'SUPPRESS_ROLES',
			subtitle: 'SUPPRESS_ROLES_SUBTITLE',
		}),
		highlights: setting.boolean({
			default: true,
			title: 'SUPPRESS_HIGHLIGHTS',
			subtitle: 'SUPPRESS_HIGHLIGHTS_SUBTITLE',
		}),
		events: setting.boolean({
			default: true,
			title: 'MUTE_EVENTS',
			subtitle: 'MUTE_EVENTS_SUBTITLE',
		}),
		showAllChannels: setting.boolean({
			default: true,
			title: 'SHOW_ALL_CHANNELS',
			subtitle: 'SHOW_ALL_CHANNELS_SUBTITLE',
		}),
		// Up to 1.0.x this held Discord's numeric level; src/settings-migration.ts turns a stored number into its key.
		messages: setting.choice({
			default: 'serverDefault',
			title: 'SERVER_NOTIFICATION_SETTINGS',
			options: {
				all: 'NOTIFY_ALL',
				mentions: 'NOTIFY_MENTIONS',
				nothing: 'NOTIFY_NOTHING',
				serverDefault: 'NOTIFY_DEFAULT',
			},
		}),
	},
	{ title: 'WHEN_YOU_JOIN' },
);
