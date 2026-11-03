import { CHANNEL_SCOPES, ChannelType, SETTINGS, type ChannelScope } from '~/constants';

type Mention = string | { id?: unknown } | null | undefined;

export type PingMessage = {
	id: string;
	channel_id?: string;
	channelId?: string;
	mentions?: Mention[];
	mention_everyone?: boolean;
	mentionEveryone?: boolean;
};

export type PingSettings = {
	channelToAffect: ChannelScope;
	allowMentions: boolean;
	allowEveryone: boolean;
};

export type PingContext = {
	channelType: number | undefined;
	currentUserId: string | undefined;
	oldestUnreadMessageId: string | null | undefined;
	settings: PingSettings;
};

/**
 * @description Reads the plugin's settings, falling back to the defaults for missing or invalid values.
 * @param read Reads one stored value, with its default.
 * @returns The settings the ping rules use.
 */
export function readPingSettings(read: <T>(key: string, fallback: T) => T): PingSettings {
	const scope = read<unknown>('channelToAffect', SETTINGS.channelToAffect);

	return {
		channelToAffect: CHANNEL_SCOPES.includes(scope as ChannelScope)
			? (scope as ChannelScope)
			: SETTINGS.channelToAffect,
		allowMentions: read('allowMentions', SETTINGS.allowMentions) === true,
		allowEveryone: read('allowEveryone', SETTINGS.allowEveryone) === true,
	};
}

/**
 * @description Reads the channel a message was sent in.
 * @param message The message.
 * @returns The channel id, if the message names one.
 */
export function messageChannelId(message: PingMessage): string | undefined {
	return message.channel_id ?? message.channelId;
}

function mentionId(mention: Mention): unknown {
	return typeof mention === 'string' ? mention : mention?.id;
}

function mentionsUser(message: PingMessage, userId: string | undefined): boolean {
	if (!userId || !Array.isArray(message.mentions)) return false;

	return message.mentions.some((mention) => mentionId(mention) === userId);
}

function mentionsEveryone(message: PingMessage): boolean {
	return message.mention_everyone === true || message.mentionEveryone === true;
}

function isAffectedChannel(channelType: number | undefined, scope: ChannelScope): boolean {
	if (channelType === ChannelType.DM) return scope !== 'group_dm';
	if (channelType === ChannelType.GROUP_DM) return scope !== 'user_dm';

	return false;
}

/**
 * @description Decides whether a message may play the in-app message sound: always outside the affected DMs, for allowed mentions, and otherwise only while it is the oldest unread message of its DM.
 * @param message The message the sound is for.
 * @param context The channel type, signed-in user, read state and settings.
 * @returns Whether the sound may play.
 */
export function shouldPing(message: PingMessage, context: PingContext): boolean {
	const { channelType, currentUserId, oldestUnreadMessageId, settings } = context;

	if (!isAffectedChannel(channelType, settings.channelToAffect)) return true;
	if (settings.allowMentions && mentionsUser(message, currentUserId)) return true;
	if (settings.allowEveryone && mentionsEveryone(message)) return true;
	if (oldestUnreadMessageId == null) return true;

	return oldestUnreadMessageId === message.id;
}

export type PingLookups = {
	channelType: (channelId: string) => number | undefined;
	currentUserId: () => string | undefined;
	oldestUnreadMessageId: (channelId: string) => string | null | undefined;
	settings: () => PingSettings;
};

/**
 * @description Decides whether the in-app message sound may play for the message a sound call resolved to, playing it when no message or channel is known.
 * @param message The resolved message, if any.
 * @param lookups Reads the channel type, signed-in user, read state and settings.
 * @returns Whether the sound may play.
 */
export function mayPlaySound(message: PingMessage | undefined, lookups: PingLookups): boolean {
	if (!message) return true;

	const channelId = messageChannelId(message);

	if (!channelId) return true;

	return shouldPing(message, {
		channelType: lookups.channelType(channelId),
		currentUserId: lookups.currentUserId(),
		oldestUnreadMessageId: lookups.oldestUnreadMessageId(channelId),
		settings: lookups.settings(),
	});
}
