import { describe, expect, test } from 'bun:test';

import { firstFound, newer, timeAgo } from '~/lib/newest';

describe('newest message', () => {
	test('reads the first hit of a search', () => {
		expect(
			firstFound({
				messages: [
					[{ id: '1', channel_id: '2', timestamp: '2026-11-14T00:11:43.273000+00:00' }],
				],
			}),
		).toEqual({ id: '1', channelId: '2', timestamp: Date.parse('2026-11-14T00:11:43.273Z') });
	});

	test('finds nothing in an empty or broken search', () => {
		expect(firstFound({ messages: [] })).toBeUndefined();
		expect(firstFound({ messages: [[{ id: '1' }]] })).toBeUndefined();
		expect(firstFound(undefined)).toBeUndefined();
	});

	test('picks the newer message', () => {
		const old = { id: '1', channelId: 'a', timestamp: 1 };
		const recent = { id: '2', channelId: 'b', timestamp: 2 };

		expect(newer(old, recent)).toBe(recent);
		expect(newer(undefined, old)).toBe(old);
		expect(newer(recent, undefined)).toBe(recent);
	});
});

describe('time ago', () => {
	test('picks the largest whole unit', () => {
		const now = Date.UTC(2026, 10, 14);

		expect(timeAgo(now - 3 * 24 * 3600 * 1000, now)).toEqual({ count: 3, unit: 'day' });
		expect(timeAgo(now - 90 * 60 * 1000, now)).toEqual({ count: 1, unit: 'hour' });
		expect(timeAgo(now - 5000, now)).toEqual({ count: 0, unit: 'now' });
	});
});
