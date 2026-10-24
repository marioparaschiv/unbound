import { ChannelStore, UserProfileStore, UserStore } from '~/modules';
import { cleanMessage, isRawObject, sortKeys, type RawObject } from '~/raw-data';

export type RawItem = {
	type: 'Message' | 'Profile' | 'Channel' | 'Guild' | 'User';
	data: RawObject;
	content?: string;
};

export type SheetProps = {
	message?: unknown;
	profile?: unknown;
	channel?: unknown;
	guild?: unknown;
	user?: unknown;
	channelId?: unknown;
	guildId?: unknown;
	userId?: unknown;
};

// UNKNOWN: sheet props come from Discord untyped.
function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function supportsRawSheet(key: string): boolean {
	return (
		/MessageLongPressActionSheet$/i.test(key) ||
		/^UserProfile/i.test(key) ||
		/^GuildActionSheet:/i.test(key) ||
		/Channel(?:LongPress)?ActionSheet/i.test(key)
	);
}

/**
 * @description Picks the record an action sheet is about: its message, profile, channel, guild or user.
 * @param key The action sheet's key, which names the sheet.
 * @param props The props Discord opened the sheet with.
 * @returns The item to show raw, or `null` when the sheet is not one View Raw supports.
 */
export function getRawItem(key: string, props: SheetProps): RawItem | null {
	if (!supportsRawSheet(key)) return null;

	const { message, profile, channel, guild } = props;

	if (isRawObject(message)) {
		return {
			type: 'Message',
			data: cleanMessage(message),
			content: asString(message.content) ?? '',
		};
	}

	if (isRawObject(profile)) return { type: 'Profile', data: sortKeys(profile) };

	if (isRawObject(channel)) return { type: 'Channel', data: sortKeys(channel) };

	if (isRawObject(guild)) return { type: 'Guild', data: sortKeys(guild) };

	const channelId = asString(props.channelId);
	// Optional: without the channel or profile store, the item falls back to what the props carry.
	const storedChannel = channelId ? ChannelStore.getChannel?.(channelId) : undefined;

	if (storedChannel) return { type: 'Channel', data: sortKeys(storedChannel) };

	const propUser = isRawObject(props.user) ? props.user : undefined;
	const userId = asString(props.userId) ?? asString(propUser?.id);
	const user = propUser ?? (userId ? UserStore.getUser(userId) : undefined);

	if (!user) return null;

	if (!/profile/i.test(key) || !userId) return { type: 'User', data: sortKeys(user) };

	const userProfile =
		UserProfileStore.getGuildMemberProfile?.(userId, asString(props.guildId)) ??
		UserProfileStore.getUserProfile?.(userId);

	return userProfile
		? { type: 'Profile', data: sortKeys(userProfile) }
		: { type: 'User', data: sortKeys(user) };
}

export default { getRawItem };
