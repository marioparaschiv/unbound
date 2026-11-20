import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		redText: setting.boolean({
			default: true,
			title: 'RED_TEXT',
			subtitle: 'RED_TEXT_SUBTITLE',
		}),
		deletedHighlight: setting.boolean({
			default: false,
			title: 'DELETED_HIGHLIGHT',
			subtitle: 'DELETED_HIGHLIGHT_SUBTITLE',
		}),
		highlightBackground: setting.string({ default: '', hidden: true }),
		highlightBar: setting.string({ default: '', hidden: true }),
		editedText: setting.string({ default: '', hidden: true }),
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
		persistLog: setting.boolean({
			default: true,
			title: 'PERSIST_LOG',
			subtitle: 'PERSIST_LOG_SUBTITLE',
		}),
		logDeletedAttachments: setting.boolean({
			default: true,
			title: 'LOG_DELETED_ATTACHMENTS',
			subtitle: 'LOG_DELETED_ATTACHMENTS_SUBTITLE',
		}),
		logDeletedChannels: setting.boolean({
			default: true,
			title: 'LOG_DELETED_CHANNELS',
			subtitle: 'LOG_DELETED_CHANNELS_SUBTITLE',
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
		// The ignore lists store ids separated by commas; src/settings.tsx draws each as a page of picked entities.
		ignoreUsers: setting.string({ default: '', hidden: true }),
		ignoreChannels: setting.string({ default: '', hidden: true }),
		ignoreGuilds: setting.string({ default: '', hidden: true }),
	},
	{ title: 'PREFERENCES' },
);
