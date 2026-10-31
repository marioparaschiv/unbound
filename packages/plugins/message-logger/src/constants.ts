export const PLUGIN_NAME = 'Message Logger';

export const EPHEMERAL_FLAG = 64;

export const CHANGE_TYPE_NONE = 0;

export const CHANGE_TYPE_UPDATE = 2;

export const DELETED_TEXT_COLOR = '#f23f42';

export const HELP_ARTICLE_URL = 'https://vencord.dev/plugins/MessageLogger';

export const DELETED_ATTACHMENT_PREFIX = '(deleted) ';

export const DEFAULT_SETTINGS = {
	redText: true,
	deletedMarker: true,
	logDeletes: true,
	logEdits: true,
	logDeletedAttachments: true,
	inlineEdits: true,
	ignoreBots: true,
	ignoreSelf: false,
	ignoreUsers: '',
	ignoreChannels: '',
	ignoreGuilds: '',
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;
