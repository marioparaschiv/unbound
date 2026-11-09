import { describe, expect, test } from 'bun:test';

import { data, loadedIds } from '~/metro/state';

describe('loadedIds', () => {
	test('merges ids loaded since the last call into id order, leaving the earlier array intact', () => {
		data.initialized.push(30, 10, 20);
		const first = loadedIds();

		expect(first).toEqual([10, 20, 30]);
		expect(loadedIds()).toBe(first);

		data.initialized.push(25, 5, 40, 15);
		expect(loadedIds()).toEqual([5, 10, 15, 20, 25, 30, 40]);
		expect(first).toEqual([10, 20, 30]);
	});
});
