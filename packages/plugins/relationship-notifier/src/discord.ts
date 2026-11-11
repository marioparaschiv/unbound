import { AVATAR_SIZE } from '~/constants';
import {
	AsyncUsers,
	ChannelStore,
	GatewayConnectionStore,
	GuildAvailabilityStore,
	GuildMemberStore,
	GuildStore,
	LurkingStore,
	Profiles,
	RelationshipStore,
	UserStore,
} from '~/modules';
import {
	isJoinedGuild,
	snapshotGroups,
	snapshotGuilds,
	snapshotRelationships,
	type ChannelLike,
	type GuildLike,
	type RelationshipSource,
	type Snapshot,
} from '~/snapshot';
import type { NamedUser } from '~/messages';

export type DiscordUser = NamedUser & {
	id: string;
	getAvatarURL?: (guildId: undefined, size: number, animated: boolean) => unknown;
};

type PrivateChannels = {
	getSortedPrivateChannels?: () => ChannelLike[];
	getMutablePrivateChannels?: () => Record<string, ChannelLike>;
};

type Relationships = {
	getMutableRelationships?: () => RelationshipSource;
	getRelationships?: () => RelationshipSource;
};

/**
 * @description Reads the signed-in user's id.
 * @returns The id, or `undefined` before Discord has a signed-in user.
 */
export function currentUserId(): string | undefined {
	return UserStore.getCurrentUser()?.id;
}

function readGuilds(userId: string): Snapshot['guilds'] {
	return snapshotGuilds(GuildStore.getGuilds(), (id, guild: GuildLike) =>
		isJoinedGuild(guild, {
			isMember: GuildMemberStore.isMember(id, userId) === true,
			isLurking: LurkingStore.isLurking?.(id) === true,
		}),
	);
}

function readGroups(): Snapshot['groups'] {
	const store = ChannelStore as typeof ChannelStore & PrivateChannels;
	const channels =
		store.getSortedPrivateChannels?.() ??
		Object.values(store.getMutablePrivateChannels?.() ?? {});

	return snapshotGroups(channels);
}

function readRelationships(): Pick<Snapshot, 'friends' | 'requests'> {
	const store = RelationshipStore as typeof RelationshipStore & Relationships;

	return snapshotRelationships(store.getMutableRelationships?.() ?? store.getRelationships?.());
}

const readers = {
	guilds: (userId: string): Partial<Snapshot> => ({ guilds: readGuilds(userId) }),
	groups: (): Partial<Snapshot> => ({ groups: readGroups() }),
	relationships: (): Partial<Snapshot> => readRelationships(),
};

export type SnapshotPart = keyof typeof readers;

/**
 * @description Reads the part of the snapshot that one kind of event can change.
 * @param part Which part to read.
 * @param userId The signed-in user's id.
 * @returns The fields of that part.
 */
export function readPart(part: SnapshotPart, userId: string): Partial<Snapshot> {
	return readers[part](userId);
}

/**
 * @description Reads the whole snapshot from Discord's stores.
 * @param userId The signed-in user's id.
 * @returns The current guilds, groups, friends and incoming requests.
 */
export function readSnapshot(userId: string): Snapshot {
	return { guilds: readGuilds(userId), groups: readGroups(), ...readRelationships() };
}

/**
 * @description Checks whether the gateway is connected, so the stores hold the account's live state rather than a cached one.
 * @returns Whether the gateway is connected; `true` when this build cannot tell.
 */
export function isConnected(): boolean {
	return GatewayConnectionStore.isConnected?.() ?? true;
}

let warnedAvailabilityUnknown = false;

function warnAvailabilityUnknown(): void {
	if (warnedAvailabilityUnknown) return;

	warnedAvailabilityUnknown = true;
	logger.warn(
		'GuildAvailabilityStore.isUnavailable was not found, so servers missing while offline are not reported.',
	);
}

/**
 * @description Checks whether a guild is in an outage, when its removal is not the user leaving it.
 * @param id The guild id.
 * @returns Whether Discord marks the guild unavailable, or `undefined` when this build cannot tell.
 */
export function isGuildUnavailable(id: string): boolean | undefined {
	const isUnavailable = GuildAvailabilityStore.isUnavailable;

	if (typeof isUnavailable !== 'function') {
		warnAvailabilityUnknown();

		return undefined;
	}

	return isUnavailable.call(GuildAvailabilityStore, id) === true;
}

/**
 * @description Reads the user's current relationship with someone.
 * @param id The other user's id.
 * @returns The relationship type, `0` for none.
 */
export function relationshipType(id: string): number {
	return RelationshipStore.getRelationshipType(id) ?? 0;
}

/**
 * @description Finds a user in Discord's cache, fetching them when they are not loaded.
 * @param id The user id.
 * @returns The user, or `undefined` when they cannot be loaded.
 */
export async function resolveUser(id: string): Promise<DiscordUser | undefined> {
	const cached = UserStore.getUser(id) as DiscordUser | undefined;

	if (cached) return cached;

	try {
		await AsyncUsers.getUser(id);
	} catch {
		return undefined;
	}

	return UserStore.getUser(id) as DiscordUser | undefined;
}

/**
 * @description Builds the avatar URL of a user, for a notification's icon.
 * @param user The user.
 * @returns The URL, or `undefined` when the user record cannot build one.
 */
export function avatarURL(user: DiscordUser): string | undefined {
	const url = user.getAvatarURL?.(undefined, AVATAR_SIZE, false);

	return typeof url === 'string' ? url : undefined;
}

/**
 * @description Opens a user's profile.
 * @param userId The user id.
 */
export function openProfile(userId: string): void {
	Profiles.showUserProfile?.({ userId });
}
