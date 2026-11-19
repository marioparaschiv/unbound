import { describe, expect, test } from 'bun:test';

import { createFloodCounter, FLOOD_LIMIT, FLOOD_WINDOW_MS } from '~/diagnostics/rejection-floods';

describe('createFloodCounter', () => {
	test('reports a plugin once when it reaches the limit within a minute', () => {
		const count = createFloodCounter(() => 0);
		const results = Array.from({ length: FLOOD_LIMIT + 5 }, () => count('noisy'));

		expect(results.filter(Boolean)).toHaveLength(1);
		expect(results[FLOOD_LIMIT - 1]).toBe(true);
	});

	test('forgets rejections older than the window and counts plugins apart', () => {
		let time = 0;
		const count = createFloodCounter(() => time);

		for (let index = 0; index < FLOOD_LIMIT - 1; index++) count('slow');

		time = FLOOD_WINDOW_MS + 1;
		expect(count('slow')).toBe(false);
		expect(count('other')).toBe(false);
	});
});
