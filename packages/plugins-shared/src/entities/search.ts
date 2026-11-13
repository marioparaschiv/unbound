import {
	describeChannel,
	describeGuild,
	describeUser,
	GuildChannels,
	Guilds,
	Relationships,
	SortedGuilds,
	Users,
} from './describe';
import type { Entity, EntityKind } from './entity';

const LIMIT = 50;

// Channel types worth ignoring or picking: text, voice, category, announcement, stage, forum and media.
const PICKABLE_CHANNELS = new Set([0, 2, 4, 5, 13, 15, 16]);

function cachedUsers(): Entity[] {
	const friends = new Set(Relationships.getFriendIDs());
	const self = Users.getCurrentUser()?.id;

	// Friends first, then every other user Discord has loaded: DM recipients, server members, message authors.
	return Object.values(Users.getUsers())
		.filter((user) => user.id !== self)
		.sort((left, right) => Number(friends.has(right.id)) - Number(friends.has(left.id)))
		.map(describeUser);
}

function sortedGuilds(): Entity[] {
	const order = SortedGuilds.getFlattenedGuildIds();

	return order.flatMap((id) => {
		const guild = Guilds.getGuild(id);

		return guild ? [describeGuild(guild)] : [];
	});
}

function guildChannels(): Entity[] {
	return sortedGuilds().flatMap(({ id }) =>
		Object.values(GuildChannels.getMutableGuildChannelsForGuild(id))
			.filter((channel) => PICKABLE_CHANNELS.has(channel.type))
			.map(describeChannel),
	);
}

function candidates(kind: EntityKind): Entity[] {
	switch (kind) {
		case 'user':
			return cachedUsers();
		case 'guild':
			return sortedGuilds();
		case 'channel':
			return guildChannels();
	}
}

/**
 * @description Searches the users, servers or channels Discord has loaded, by name, `@username` or id.
 * @param kind What to search.
 * @param query The search text; empty lists the first ones.
 * @param exclude Ids to leave out, such as those already picked.
 * @returns Up to 50 matches, friends and servers in the user's own order first.
 */
export function searchEntities(kind: EntityKind, query: string, exclude: string[] = []): Entity[] {
	const needle = query.trim().toLowerCase().replace(/^[@#]/, '');
	const skipped = new Set(exclude);
	const matches: Entity[] = [];

	for (const entity of candidates(kind)) {
		if (matches.length >= LIMIT) break;

		if (skipped.has(entity.id)) continue;

		const haystack = [entity.id, entity.name, entity.detail ?? ''].join('\n').toLowerCase();

		if (!needle || haystack.includes(needle)) matches.push(entity);
	}

	return matches;
}

export default searchEntities;
