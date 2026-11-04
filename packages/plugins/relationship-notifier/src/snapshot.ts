import { CDN_URL, GROUP_DM_CHANNEL_TYPE, RelationshipType } from '~/constants';

export type SimpleEntry = {
	id: string;
	name: string;
	iconURL?: string;
};

export type Snapshot = {
	guilds: SimpleEntry[];
	groups: SimpleEntry[];
	friends: string[];
	requests: string[];
};

export type GuildLike = {
	id?: string;
	name?: string;
	icon?: string | null;
	lurker?: boolean;
};

export type GuildMembership = {
	isMember: boolean;
	isLurking: boolean;
};

/**
 * @description Decides whether the user is in a guild, as Vencord does with `isMember`, leaving out guilds the user only previews.
 * @param guild The guild record.
 * @param membership What the member and lurking stores say about the user in that guild.
 * @returns Whether the guild belongs in the snapshot.
 */
export function isJoinedGuild(guild: GuildLike, { isMember, isLurking }: GuildMembership): boolean {
	return isMember && !isLurking && guild.lurker !== true;
}

export type ChannelLike = {
	id: string;
	type: number;
	name?: string | null;
	icon?: string | null;
	rawRecipients?: { username?: string }[];
};

export type RelationshipValue = number | { type?: number } | null | undefined;

export type RelationshipSource =
	| Map<string, RelationshipValue>
	| Record<string, RelationshipValue>
	| null
	| undefined;

/**
 * @description Builds an empty snapshot.
 * @returns A snapshot with no guilds, groups, friends or requests.
 */
export function emptySnapshot(): Snapshot {
	return { guilds: [], groups: [], friends: [], requests: [] };
}

/**
 * @description Builds the CDN URL of a guild icon.
 * @param id The guild id.
 * @param icon The icon hash.
 * @returns The icon URL, or `undefined` when the guild has no icon.
 */
export function guildIconURL(id: string, icon: string | null | undefined): string | undefined {
	return icon ? `${CDN_URL}/icons/${id}/${icon}.png` : undefined;
}

/**
 * @description Builds the CDN URL of a group chat icon.
 * @param id The channel id.
 * @param icon The icon hash.
 * @returns The icon URL, or `undefined` when the group has no icon.
 */
export function groupIconURL(id: string, icon: string | null | undefined): string | undefined {
	return icon ? `${CDN_URL}/channel-icons/${id}/${icon}.png` : undefined;
}

/**
 * @description Lists the guilds the user is in, with the name and icon to show if they are removed.
 * @param guilds Discord's guilds by id.
 * @param isJoined Whether the user is a member of a guild, rather than only previewing it.
 * @returns One entry per joined guild.
 */
export function snapshotGuilds(
	guilds: Record<string, GuildLike> | null | undefined,
	isJoined: (id: string, guild: GuildLike) => boolean,
): SimpleEntry[] {
	return Object.entries(guilds ?? {})
		.filter(([id, guild]) => isJoined(id, guild))
		.map(([id, guild]) => ({
			id,
			name: guild.name ?? id,
			iconURL: guildIconURL(id, guild.icon),
		}));
}

/**
 * @description Names a group chat the way Discord does when it has no name: its recipients' usernames.
 * @param channel The group chat.
 * @returns The group's display name.
 */
export function groupName(channel: ChannelLike): string {
	if (channel.name) return channel.name;

	const usernames = (channel.rawRecipients ?? []).flatMap((recipient) =>
		recipient.username ? [recipient.username] : [],
	);

	return usernames.length
		? new Intl.ListFormat('en', { type: 'unit' }).format(usernames)
		: channel.id;
}

/**
 * @description Lists the group chats the user is in.
 * @param channels The user's private channels.
 * @returns One entry per group chat.
 */
export function snapshotGroups(channels: Iterable<ChannelLike> | null | undefined): SimpleEntry[] {
	return Array.from(channels ?? [])
		.filter((channel) => channel.type === GROUP_DM_CHANNEL_TYPE)
		.map((channel) => ({
			id: channel.id,
			name: groupName(channel),
			iconURL: groupIconURL(channel.id, channel.icon),
		}));
}

/**
 * @description Reads a relationship type from a store entry, which is a number or a record with `type`.
 * @param value The store entry.
 * @returns The relationship type, or `0` when there is none.
 */
export function relationshipTypeOf(value: RelationshipValue): number {
	if (typeof value === 'number') return value;

	return value?.type ?? 0;
}

/**
 * @description Splits the user's relationships into friends and incoming friend requests.
 * @param relationships The relationships by user id, as a `Map` or an object.
 * @returns The friend ids and the ids of users with a pending incoming request.
 */
export function snapshotRelationships(
	relationships: RelationshipSource,
): Pick<Snapshot, 'friends' | 'requests'> {
	const entries =
		relationships instanceof Map
			? Array.from(relationships)
			: Object.entries(relationships ?? {});
	const friends: string[] = [];
	const requests: string[] = [];

	for (const [id, value] of entries) {
		const type = relationshipTypeOf(value);

		if (type === RelationshipType.FRIEND) friends.push(id);
		else if (type === RelationshipType.INCOMING_REQUEST) requests.push(id);
	}

	return { friends, requests };
}

function isEntry(value: unknown): value is SimpleEntry {
	const entry = value as SimpleEntry | null;

	return (
		typeof entry?.id === 'string' &&
		typeof entry.name === 'string' &&
		(entry.iconURL === undefined || typeof entry.iconURL === 'string')
	);
}

function entries(value: unknown): SimpleEntry[] {
	return Array.isArray(value) ? value.filter(isEntry) : [];
}

function ids(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
}

/**
 * @description Reads a saved snapshot, dropping anything malformed.
 * @param text The saved JSON.
 * @returns The snapshot, or `undefined` when the text is not a snapshot.
 */
export function parseSnapshot(text: string): Snapshot | undefined {
	let value: unknown;

	try {
		value = JSON.parse(text);
	} catch {
		return undefined;
	}

	if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

	const saved = value as Record<keyof Snapshot, unknown>;

	return {
		guilds: entries(saved.guilds),
		groups: entries(saved.groups),
		friends: ids(saved.friends),
		requests: ids(saved.requests),
	};
}
