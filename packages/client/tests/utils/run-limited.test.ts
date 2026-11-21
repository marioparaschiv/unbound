import { describe, expect, test } from 'bun:test';

import { runLimited } from '~/utils/run-limited';

describe('runLimited', () => {
	test('keeps results in order and never runs more than the limit at once', async () => {
		let running = 0;
		let peak = 0;

		const results = await runLimited([5, 1, 4, 2, 3], 2, async (ms) => {
			running++;
			peak = Math.max(peak, running);
			await new Promise((resolve) => setTimeout(resolve, ms));
			running--;

			return ms * 10;
		});

		expect(results).toEqual([50, 10, 40, 20, 30]);
		expect(peak).toBe(2);
	});

	test('returns an empty list for no items', async () => {
		expect(await runLimited([], 4, async () => 1)).toEqual([]);
	});
});
