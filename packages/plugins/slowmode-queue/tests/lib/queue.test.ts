import { describe, expect, test } from 'bun:test';

import { createQueue } from '~/lib/queue';

describe('per-channel queue', () => {
	test('runs holds in the same channel one after another, and other channels alongside', async () => {
		const queue = createQueue();
		const order: string[] = [];

		const first = queue.enqueue('a').then((release) => {
			order.push('a1');

			return release;
		});
		const second = queue.enqueue('a').then((release) => {
			order.push('a2');
			release();
		});
		const other = queue.enqueue('b').then((release) => {
			order.push('b1');
			release();
		});

		await other;
		expect(order).toEqual(['a1', 'b1']);

		(await first)();
		await second;
		expect(order).toEqual(['a1', 'b1', 'a2']);
	});
});
