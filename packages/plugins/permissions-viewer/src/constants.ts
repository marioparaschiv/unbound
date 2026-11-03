export const SORT_ORDERS = ['highest', 'lowest'] as const;

export type SortOrder = (typeof SORT_ORDERS)[number];

export const DEFAULT_SORT_ORDER: SortOrder = 'highest';

export const SORT_ORDER_LABELS: Record<SortOrder, string> = {
	highest: 'Highest Role',
	lowest: 'Lowest Role',
};

export const SETTINGS = {
	sortOrder: DEFAULT_SORT_ORDER as string,
	rolesCardButton: true,
};

export const EntryType = {
	Role: 0,
	Member: 1,
	Owner: 2,
} as const;

export type EntryTypeValue = (typeof EntryType)[keyof typeof EntryType];

export const ROW_KEY = 'unbound-permissions-viewer';
export const ROW_LABEL = 'View Permissions';
export const ROW_ICON = 'ShieldUserIcon';

export const ROLES_CARD_PATH = 'modules/user_profile/native/UserProfileRolesCard.tsx';

export const FALLBACK_ROLE_COLOR = '#99aab5';
export const ALLOWED_COLOR = '#23a55a';
export const DENIED_COLOR = '#f23f43';

export const PERMISSION_TITLES: Record<string, string> = {
	CREATE_INSTANT_INVITE: 'Create Invite',
	KICK_MEMBERS: 'Kick, Approve, and Reject Members',
	BAN_MEMBERS: 'Ban Members',
	ADMINISTRATOR: 'Administrator',
	MANAGE_CHANNELS: 'Manage Channels',
	MANAGE_GUILD: 'Manage Server',
	ADD_REACTIONS: 'Add Reactions',
	VIEW_AUDIT_LOG: 'View Audit Log',
	PRIORITY_SPEAKER: 'Priority Speaker',
	STREAM: 'Video',
	VIEW_CHANNEL: 'View Channels',
	SEND_MESSAGES: 'Send Messages and Create Posts',
	SEND_TTS_MESSAGES: 'Send Text-to-Speech Messages',
	MANAGE_MESSAGES: 'Manage Messages',
	EMBED_LINKS: 'Embed Links',
	ATTACH_FILES: 'Attach Files',
	READ_MESSAGE_HISTORY: 'Read Message History',
	MENTION_EVERYONE: 'Mention @everyone, @here, and All Roles',
	USE_EXTERNAL_EMOJIS: 'Use External Emoji',
	VIEW_GUILD_ANALYTICS: 'View Server Insights',
	CONNECT: 'Connect',
	SPEAK: 'Speak',
	MUTE_MEMBERS: 'Mute Members',
	DEAFEN_MEMBERS: 'Deafen Members',
	MOVE_MEMBERS: 'Move Members',
	USE_VAD: 'Use Voice Activity',
	CHANGE_NICKNAME: 'Change Nickname',
	MANAGE_NICKNAMES: 'Manage Nicknames',
	MANAGE_ROLES: 'Manage Roles',
	MANAGE_WEBHOOKS: 'Manage Webhooks',
	MANAGE_GUILD_EXPRESSIONS: 'Manage Expressions',
	USE_APPLICATION_COMMANDS: 'Use Application Commands',
	REQUEST_TO_SPEAK: 'Request to Speak',
	MANAGE_EVENTS: 'Manage Events',
	MANAGE_THREADS: 'Manage Threads and Posts',
	CREATE_PUBLIC_THREADS: 'Create Public Threads',
	CREATE_PRIVATE_THREADS: 'Create Private Threads',
	USE_EXTERNAL_STICKERS: 'Use External Stickers',
	SEND_MESSAGES_IN_THREADS: 'Send Messages in Threads and Posts',
	USE_EMBEDDED_ACTIVITIES: 'Use Activities',
	MODERATE_MEMBERS: 'Timeout Members',
	VIEW_CREATOR_MONETIZATION_ANALYTICS: 'View Server Subscription Insights',
	USE_SOUNDBOARD: 'Use Soundboard',
	CREATE_GUILD_EXPRESSIONS: 'Create Expressions',
	CREATE_EVENTS: 'Create Events',
	USE_EXTERNAL_SOUNDS: 'Use External Sounds',
	SEND_VOICE_MESSAGES: 'Send Voice Messages',
	SEND_POLLS: 'Create Polls',
	USE_EXTERNAL_APPS: 'Use External Apps',
	PIN_MESSAGES: 'Pin Messages',
	BYPASS_SLOWMODE: 'Bypass Slowmode',
};

export const OWNER_TITLE = 'Server Owner';
