export const PLAY_IN_APP_MESSAGE_SOUND_PATH =
	'modules/notifications/native/playInAppMessageSound.tsx';

export const ChannelType = {
	DM: 1,
	GROUP_DM: 3,
} as const;

export const CHANNEL_SCOPES = ['both_dms', 'user_dm', 'group_dm'] as const;

export type ChannelScope = (typeof CHANNEL_SCOPES)[number];

export const SETTINGS = {
	channelToAffect: 'both_dms' as ChannelScope,
	allowMentions: false,
	allowEveryone: false,
};

export const RECENT_MESSAGE_LIMIT = 20;

export const RECENT_MESSAGE_MAX_AGE = 10_000;
