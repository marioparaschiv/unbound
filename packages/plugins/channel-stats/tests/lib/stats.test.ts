import { describe, expect, test } from 'bun:test';

import { channelStats } from '~/lib/stats';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function message(authorId: string, authorName: string, timestamp: number) {
	return { authorId, authorName, timestamp };
}

describe('channel stats', () => {
	test('ranks who wrote most with their share', () => {
		const stats = channelStats(
			[
				message('1', 'adrián', 0),
				message('1', 'adrián', HOUR),
				message('2', 'mario', 2 * HOUR),
				message('1', 'adrián', 3 * HOUR),
			],
			(timestamp) => timestamp / HOUR,
		);

		expect(stats?.posters).toEqual([
			{ name: 'adrián', count: 3, share: 75 },
			{ name: 'mario', count: 1, share: 25 },
		]);
	});

	test('finds the busiest hours, earlier hours first on a tie', () => {
		const stats = channelStats(
			[
				message('1', 'a', 21 * HOUR),
				message('1', 'a', 21 * HOUR),
				message('1', 'a', 9 * HOUR),
			],
			(timestamp) => timestamp / HOUR,
		);

		expect(stats?.hours).toEqual([
			{ hour: 21, count: 2 },
			{ hour: 9, count: 1 },
		]);
	});

	test('averages messages per day over the loaded span', () => {
		const stats = channelStats([0, 1, 2, 3].map((day) => message('1', 'a', day * DAY + 1)));

		expect(stats?.perDay).toBe(1);
		expect(stats?.count).toBe(4);
	});

	test('has nothing to say without messages', () => {
		expect(channelStats([])).toBeUndefined();
	});
});
