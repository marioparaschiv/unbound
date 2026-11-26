import { describe, expect, test } from 'bun:test';

import { type ItemSize, withReadAllRow } from '~/lib/row-sizes';

const MESSAGES = 0;
const itemSize: ItemSize = (section) => (section === 7 ? 13 : 60);

describe('row sizes', () => {
	test('doubles only the Messages row', () => {
		const { itemSize: sized } = withReadAllRow({ itemSize }, MESSAGES, new WeakMap());

		expect(sized(MESSAGES, 0)).toBe(120);
		expect(sized(1, 0)).toBe(60);
		expect(sized(7, 0)).toBe(13);
	});

	test('keeps one wrapper per original, so the list sees a stable function', () => {
		const sized = new WeakMap<ItemSize, ItemSize>();

		expect(withReadAllRow({ itemSize }, MESSAGES, sized).itemSize).toBe(
			withReadAllRow({ itemSize }, MESSAGES, sized).itemSize,
		);
	});
});
