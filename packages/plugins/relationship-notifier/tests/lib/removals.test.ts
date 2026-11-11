import { settings } from '@unbound-app/settings';
import type { Settings } from '@unbound-app/settings';
import { describe, expect, test } from 'bun:test';

import {
	createManualRemovals,
	findOfflineRemovals,
	keepUnconfirmedGuilds,
	relationshipRemovalKind,
} from '~/lib/removals';
import type { Snapshot } from '~/lib/snapshot';

const previous: Snapshot = {
	guilds: [
		{ id: 'g1', name: 'Kept' },
		{ id: 'g2', name: 'Left' },
		{ id: 'g3', name: 'Outage' },
	],
	groups: [
		{ id: 'c1', name: 'Kept' },
		{ id: 'c2', name: 'Gone' },
	],
	friends: ['u1', 'u2'],
	requests: ['r1', 'r2', 'r3'],
};

const ALL_ON: Settings = {
	notices: false,
	offlineRemovals: true,
	friends: true,
	friendRequestCancels: true,
	servers: true,
	groups: true,
};

const current: Snapshot = {
	guilds: [{ id: 'g1', name: 'Kept' }],
	groups: [{ id: 'c1', name: 'Kept' }],
	friends: ['u1', 'r2'],
	requests: [],
};

const context = (settings: Partial<Settings> = {}) => ({
	settings: { ...ALL_ON, ...settings },
	isGuildUnavailable: (id: string): boolean | undefined => id === 'g3',
	relationshipType: (id: string) => (id === 'r2' ? 1 : id === 'r3' ? 2 : 0),
});

describe('findOfflineRemovals', () => {
	test('finds what is gone, skipping outages and settled requests', () => {
		expect(findOfflineRemovals(previous, current, context())).toEqual({
			groups: [{ id: 'c2', name: 'Gone' }],
			guilds: [{ id: 'g2', name: 'Left' }],
			friends: ['u2'],
			requests: ['r1'],
		});
	});

	test('reports nothing with offline removals off', () => {
		expect(findOfflineRemovals(previous, current, context({ offlineRemovals: false }))).toEqual(
			{
				groups: [],
				guilds: [],
				friends: [],
				requests: [],
			},
		);
	});

	test('honours each kind of notification separately', () => {
		const removals = findOfflineRemovals(
			previous,
			current,
			context({ groups: false, servers: false, friends: false, friendRequestCancels: false }),
		);

		expect(removals).toEqual({ groups: [], guilds: [], friends: [], requests: [] });
	});

	test('reports nothing when nothing changed', () => {
		expect(findOfflineRemovals(previous, previous, context())).toEqual({
			groups: [],
			guilds: [],
			friends: [],
			requests: [],
		});
	});
});

describe('guild availability', () => {
	const unknown = () => undefined;

	test('reports no servers when availability is unknown', () => {
		expect(
			findOfflineRemovals(previous, current, { ...context(), isGuildUnavailable: unknown })
				.guilds,
		).toEqual([]);
	});

	test('keeps servers in an outage or of unknown availability in the saved snapshot', () => {
		expect(
			keepUnconfirmedGuilds(previous, current, context().isGuildUnavailable).guilds,
		).toEqual([
			{ id: 'g1', name: 'Kept' },
			{ id: 'g3', name: 'Outage' },
		]);
		expect(keepUnconfirmedGuilds(previous, current, unknown).guilds).toEqual(previous.guilds);
	});

	test('drops servers confirmed gone', () => {
		expect(keepUnconfirmedGuilds(previous, current, () => false)).toBe(current);
	});
});

describe('relationshipRemovalKind', () => {
	test('reports friends and incoming requests', () => {
		expect(relationshipRemovalKind(1, ALL_ON)).toBe('friend');
		expect(relationshipRemovalKind(3, ALL_ON)).toBe('request');
	});

	test('ignores blocks and outgoing requests', () => {
		expect(relationshipRemovalKind(2, ALL_ON)).toBeUndefined();
		expect(relationshipRemovalKind(4, ALL_ON)).toBeUndefined();
	});

	test('honours the friend and request settings', () => {
		expect(relationshipRemovalKind(1, { ...ALL_ON, friends: false })).toBeUndefined();
		expect(
			relationshipRemovalKind(3, { ...ALL_ON, friendRequestCancels: false }),
		).toBeUndefined();
	});
});

describe('createManualRemovals', () => {
	test('consumes a marked id once', () => {
		const removals = createManualRemovals();

		removals.mark('1');

		expect(removals.consume('2')).toBe(false);
		expect(removals.consume('1')).toBe(true);
		expect(removals.consume('1')).toBe(false);
	});

	test('forgets every mark on clear', () => {
		const removals = createManualRemovals();

		removals.mark('1');
		removals.clear();

		expect(removals.consume('1')).toBe(false);
	});
});

describe('the settings', () => {
	test('report every removal, offline ones too, in notifications that fade, until the user changes them', () => {
		expect({ ...settings }).toEqual(ALL_ON);
	});
});
