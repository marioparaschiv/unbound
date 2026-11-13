import { expect, mock, test } from 'bun:test';

const users = {
	self: { id: '100000000000000000', username: 'me', globalName: 'Me' },
	stranger: { id: '200000000000000000', username: 'stranger', globalName: null },
	friend: { id: '300000000000000000', username: 'pal', globalName: 'Best Pal' },
};

const guilds = {
	'400000000000000000': { id: '400000000000000000', name: 'Second', icon: null },
	'500000000000000000': { id: '500000000000000000', name: 'First', icon: null },
};

const channels = {
	'600000000000000000': {
		id: '600000000000000000',
		name: 'general',
		type: 0,
		guild_id: '500000000000000000',
	},
	// A DM-like type a picker leaves out.
	'700000000000000000': {
		id: '700000000000000000',
		name: 'thread',
		type: 11,
		guild_id: '500000000000000000',
	},
};

const stores = {
	User: {
		getUser: (id: string) => Object.values(users).find((user) => user.id === id),
		getUsers: () => Object.fromEntries(Object.values(users).map((user) => [user.id, user])),
		getCurrentUser: () => users.self,
	},
	Relationship: {
		getFriendIDs: () => [users.friend.id],
		getNickname: () => undefined,
	},
	Guild: { getGuild: (id: keyof typeof guilds) => guilds[id] },
	SortedGuild: { getFlattenedGuildIds: () => ['500000000000000000', '400000000000000000'] },
	Channel: {
		getChannel: (id: keyof typeof channels) => channels[id],
		getMutableGuildChannelsForGuild: (id: string) =>
			id === '500000000000000000' ? channels : {},
	},
};

void mock.module('@unbound-app/api', () => ({
	flux: { getStore: (name: keyof typeof stores) => stores[name] },
	metro: {
		findByProps: (...props: string[]) =>
			props.includes('getMutableGuildChannelsForGuild') ? stores.Channel : undefined,
	},
}));

const { searchEntities } = await import('~/entities/search');
const { isSnowflake } = await import('~/entities/entity');

const ids = (kind: 'user' | 'guild' | 'channel', query = '', exclude?: string[]) =>
	searchEntities(kind, query, exclude).map((entity) => entity.id);

test('lists friends before other users and leaves out the current user', () => {
	expect(ids('user')).toEqual([users.friend.id, users.stranger.id]);
});

test('matches a name, an @username or an id, ignoring case', () => {
	expect(ids('user', 'best')).toEqual([users.friend.id]);
	expect(ids('user', '@STRANGER')).toEqual([users.stranger.id]);
	expect(ids('user', users.friend.id)).toEqual([users.friend.id]);
	expect(ids('user', 'nobody')).toEqual([]);
});

test('leaves out excluded ids', () => {
	expect(ids('user', '', [users.friend.id])).toEqual([users.stranger.id]);
});

test('lists servers in the user order', () => {
	expect(ids('guild')).toEqual(['500000000000000000', '400000000000000000']);
});

test('lists pickable channels with their server, matched by #name', () => {
	const [general] = searchEntities('channel', '#gen');

	expect(ids('channel')).toEqual(['600000000000000000']);
	expect(general).toMatchObject({ name: '#general', detail: 'First' });
});

test('tells a snowflake from other text', () => {
	expect(isSnowflake('300000000000000000')).toBe(true);
	expect(isSnowflake('pal')).toBe(false);
	expect(isSnowflake('123')).toBe(false);
});
