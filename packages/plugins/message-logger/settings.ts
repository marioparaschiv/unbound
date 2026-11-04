import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		redText: setting.boolean({
			default: true,
			title: 'RED_TEXT',
			subtitle: 'RED_TEXT_SUBTITLE',
		}),
		deletedMarker: setting.boolean({
			default: true,
			title: 'DELETED_MARKER',
			subtitle: 'DELETED_MARKER_SUBTITLE',
		}),
		inlineEdits: setting.boolean({
			default: true,
			title: 'INLINE_EDITS',
			subtitle: 'INLINE_EDITS_SUBTITLE',
		}),
		logDeletes: setting.boolean({
			default: true,
			title: 'LOG_DELETES',
			subtitle: 'LOG_DELETES_SUBTITLE',
		}),
		logEdits: setting.boolean({
			default: true,
			title: 'LOG_EDITS',
			subtitle: 'LOG_EDITS_SUBTITLE',
		}),
		logDeletedAttachments: setting.boolean({
			default: true,
			title: 'LOG_DELETED_ATTACHMENTS',
			subtitle: 'LOG_DELETED_ATTACHMENTS_SUBTITLE',
		}),
		ignoreBots: setting.boolean({
			default: true,
			title: 'IGNORE_BOTS',
			subtitle: 'IGNORE_BOTS_SUBTITLE',
		}),
		ignoreSelf: setting.boolean({
			default: false,
			title: 'IGNORE_SELF',
			subtitle: 'IGNORE_SELF_SUBTITLE',
		}),
		ignoreUsers: setting.string({
			default: '',
			title: 'IGNORE_USERS',
			subtitle: 'IGNORE_USERS_SUBTITLE',
		}),
		ignoreChannels: setting.string({
			default: '',
			title: 'IGNORE_CHANNELS',
			subtitle: 'IGNORE_CHANNELS_SUBTITLE',
		}),
		ignoreGuilds: setting.string({
			default: '',
			title: 'IGNORE_GUILDS',
			subtitle: 'IGNORE_GUILDS_SUBTITLE',
		}),
	},
	{ title: 'PREFERENCES' },
);
