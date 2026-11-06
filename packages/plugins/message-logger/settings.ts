import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		redText: setting.boolean({
			default: true,
			title: 'RED_TEXT',
			subtitle: 'RED_TEXT_SUBTITLE',
		}),
		deletedColor: setting.string({
			default: '#f23f42',
			title: 'DELETED_COLOR',
			subtitle: 'DELETED_COLOR_DETAIL',
			displayAs: 'color',
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
			placeholder: 'ID_PLACEHOLDER',
		}),
		ignoreChannels: setting.string({
			default: '',
			title: 'IGNORE_CHANNELS',
			subtitle: 'IGNORE_CHANNELS_SUBTITLE',
			placeholder: 'ID_PLACEHOLDER',
		}),
		ignoreGuilds: setting.string({
			default: '',
			title: 'IGNORE_GUILDS',
			subtitle: 'IGNORE_GUILDS_SUBTITLE',
			placeholder: 'ID_PLACEHOLDER',
		}),
		archive: setting.section(
			{ title: 'PERSISTENT_ARCHIVE' },
			{
				persistCapture: setting.boolean({
					default: false,
					title: 'PERSIST_CAPTURE',
					subtitle: 'PERSIST_CAPTURE_DETAIL',
				}),
				restoreInChannel: setting.boolean({
					default: true,
					title: 'RESTORE_IN_CHANNEL',
					subtitle: 'RESTORE_IN_CHANNEL_DETAIL',
				}),
				captureChannels: setting.string({
					default: '',
					title: 'CAPTURE_CHANNELS',
					subtitle: 'CAPTURE_CHANNELS_DETAIL',
					maxLength: 4000,
				}),
				retentionDays: setting.integer({
					default: 7,
					min: 1,
					max: 30,
					title: 'RETENTION_DAYS',
					displayAs: 'input',
				}),
				maxSavedEvents: setting.integer({
					default: 500,
					min: 50,
					max: 2000,
					title: 'MAX_SAVED_EVENTS',
					displayAs: 'input',
				}),
				viewSaved: setting.button({ title: 'VIEW_SAVED', action: 'viewSavedArchive' }),
				clearAccount: setting.button({
					title: 'CLEAR_SAVED_ACCOUNT',
					action: 'clearSavedAccount',
					displayAs: 'danger',
					confirm: 'CLEAR_ACCOUNT_CONFIRM',
				}),
				clearAll: setting.button({
					title: 'CLEAR_ALL_SAVED',
					action: 'clearAllSavedAccounts',
					displayAs: 'danger',
					confirm: 'CLEAR_ALL_CONFIRM',
				}),
				privacy: setting.notice({
					title: 'ARCHIVE_PRIVACY',
					subtitle: 'ARCHIVE_PRIVACY_DETAIL',
					tone: 'warning',
				}),
			},
		),
	},
	{ title: 'PREFERENCES' },
);
