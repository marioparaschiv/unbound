import { describe, expect, test } from 'bun:test';

import { storePlace } from '~/bubbles/android/store-groups';

const ids = ['a1', 'a2', 'b1'];

describe('store groups', () => {
	test('places a message between its neighbours, oldest first', () => {
		const starts = new Map([
			['a1', true],
			['a2', false],
			['b1', true],
		]);

		expect(storePlace(ids, 'a1', starts)).toEqual({
			start: true,
			end: false,
			below: 'a2',
		});
		expect(storePlace(ids, 'a2', starts)).toEqual({
			start: false,
			end: true,
			above: 'a1',
			below: 'b1',
		});
	});

	test('ends a group at a message below that is not measured yet', () => {
		expect(storePlace(ids, 'a1', new Map([['a1', true]]))).toMatchObject({ end: true });
	});

	test('treats an unmeasured or unknown message as its own group', () => {
		expect(storePlace(ids, 'x', new Map())).toEqual({ start: true, end: true });
	});
});
