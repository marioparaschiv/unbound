import { describe, expect, test } from 'bun:test';

import {
	groupIconURL,
	groupName,
	guildIconURL,
	parseSnapshot,
	relationshipTypeOf,
	snapshotGroups,
	isJoinedGuild,
	snapshotGuilds,
	snapshotRelationships,
} from '~/lib/snapshot';

describe('isJoinedGuild', () => {
	test('counts a guild the user is a member of', () => {
		expect(isJoinedGuild({}, { isMember: true, isLurking: false })).toBe(true);
	});

	test('leaves out guilds the user only previews, whatever the record carries', () => {
		expect(isJoinedGuild({}, { isMember: false, isLurking: false })).toBe(false);
		expect(isJoinedGuild({}, { isMember: true, isLurking: true })).toBe(false);
		expect(isJoinedGuild({ lurker: true }, { isMember: true, isLurking: false })).toBe(false);
	});
});

describe('icon URLs', () => {
	test('builds guild and group icon URLs from their hashes', () => {
		expect(guildIconURL('1', 'abc')).toBe('https://cdn.discordapp.com/icons/1/abc.png');
		expect(groupIconURL('2', 'def')).toBe('https://cdn.discordapp.com/channel-icons/2/def.png');
	});

	test('has no URL without an icon', () => {
		expect(guildIconURL('1', null)).toBeUndefined();
		expect(groupIconURL('2', undefined)).toBeUndefined();
	});
});

describe('snapshotGuilds', () => {
	test('keeps only joined guilds', () => {
		const guilds = {
			'1': { name: 'Joined', icon: 'hash' },
			'2': { name: 'Previewed', icon: null },
		};

		expect(snapshotGuilds(guilds, (id) => id === '1')).toEqual([
			{ id: '1', name: 'Joined', iconURL: 'https://cdn.discordapp.com/icons/1/hash.png' },
		]);
	});

	test('reads a missing store as no guilds', () => {
		expect(snapshotGuilds(undefined, () => true)).toEqual([]);
	});
});

describe('snapshotGroups', () => {
	test('keeps only group chats', () => {
		const channels = [
			{ id: '10', type: 1, name: '' },
			{ id: '11', type: 3, name: 'Friends', icon: 'i' },
		];

		expect(snapshotGroups(channels)).toEqual([
			{
				id: '11',
				name: 'Friends',
				iconURL: 'https://cdn.discordapp.com/channel-icons/11/i.png',
			},
		]);
	});

	test('names an unnamed group after its recipients', () => {
		expect(
			groupName({
				id: '1',
				type: 3,
				name: '',
				rawRecipients: [{ username: 'a' }, { username: 'b' }],
			}),
		).toBe('a, b');
	});

	test('falls back to the id when nothing names the group', () => {
		expect(groupName({ id: '1', type: 3, name: null })).toBe('1');
	});
});

describe('snapshotRelationships', () => {
	test('splits a Map of types into friends and incoming requests', () => {
		const relationships = new Map([
			['1', 1],
			['2', 2],
			['3', 3],
			['4', 4],
		]);

		expect(snapshotRelationships(relationships)).toEqual({ friends: ['1'], requests: ['3'] });
	});

	test('reads an object of relationship records', () => {
		expect(snapshotRelationships({ '5': { type: 1 }, '6': { type: 3 } })).toEqual({
			friends: ['5'],
			requests: ['6'],
		});
	});

	test('reads a missing entry as no relationship', () => {
		expect(relationshipTypeOf(undefined)).toBe(0);
		expect(snapshotRelationships(undefined)).toEqual({ friends: [], requests: [] });
	});
});

describe('parseSnapshot', () => {
	test('reads a saved snapshot back', () => {
		const snapshot = {
			guilds: [{ id: '1', name: 'Guild', iconURL: 'https://x' }],
			groups: [{ id: '2', name: 'Group' }],
			friends: ['3'],
			requests: ['4'],
		};

		expect(parseSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
	});

	test('drops malformed entries', () => {
		expect(
			parseSnapshot(
				JSON.stringify({ guilds: [{ id: 1 }, { id: '1', name: 'Ok' }], friends: [3, '3'] }),
			),
		).toEqual({ guilds: [{ id: '1', name: 'Ok' }], groups: [], friends: ['3'], requests: [] });
	});

	test('rejects text that is not a snapshot', () => {
		expect(parseSnapshot('not json')).toBeUndefined();
		expect(parseSnapshot('[]')).toBeUndefined();
		expect(parseSnapshot('null')).toBeUndefined();
	});
});
