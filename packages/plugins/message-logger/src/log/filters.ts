import { EPHEMERAL_FLAG } from '~/constants';

export type FilterSettings = {
	logDeletes: boolean;
	logEdits: boolean;
	ignoreBots: boolean;
	ignoreSelf: boolean;
	ignoreUsers: string;
	ignoreChannels: string;
	ignoreGuilds: string;
};

export type FilteredMessage = {
	author?: { id?: string; bot?: boolean } | null;
	channel_id?: string;
	flags?: number;
};

export type FilteredChannel = {
	parent_id?: string | null;
	guild_id?: string | null;
};

export type FilterContext = {
	currentUserId: string | undefined;
	channel: FilteredChannel | undefined;
};

/**
 * @description Reads a list of IDs typed with commas, spaces or new lines between them.
 * @param value The typed list.
 * @returns The IDs.
 */
export function idList(value: string): Set<string> {
	return new Set(value.split(/[\s,]+/).filter(Boolean));
}

/**
 * @description Tells whether a message is an ephemeral one, which only exists on this device.
 * @param message The message.
 * @returns `true` for an ephemeral message.
 */
export function isEphemeral(message: FilteredMessage): boolean {
	return ((message.flags ?? 0) & EPHEMERAL_FLAG) === EPHEMERAL_FLAG;
}

/**
 * @description Tells whether a deletion or an edit of a message should go unlogged.
 * @param message The message.
 * @param settings The plugin's settings.
 * @param context The current user and the message's channel.
 * @param isEdit Whether the change is an edit rather than a deletion.
 * @returns `true` when the change should go unlogged.
 */
export function shouldIgnore(
	message: FilteredMessage,
	settings: FilterSettings,
	context: FilterContext,
	isEdit: boolean,
): boolean {
	const authorId = message.author?.id;
	const { channel } = context;
	const ignoredChannels = idList(settings.ignoreChannels);

	return (
		isEphemeral(message) ||
		(isEdit ? !settings.logEdits : !settings.logDeletes) ||
		(settings.ignoreBots && !!message.author?.bot) ||
		(settings.ignoreSelf && !!authorId && authorId === context.currentUserId) ||
		(!!authorId && idList(settings.ignoreUsers).has(authorId)) ||
		(!!message.channel_id && ignoredChannels.has(message.channel_id)) ||
		(!!channel?.parent_id && ignoredChannels.has(channel.parent_id)) ||
		(!!channel?.guild_id && idList(settings.ignoreGuilds).has(channel.guild_id))
	);
}

export default shouldIgnore;
