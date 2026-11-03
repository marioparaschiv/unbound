import { expect, test } from 'bun:test';

import { normalizeSortOrder, toggleSortOrder } from '~/permissions/sort-order';

test('reads a saved order and falls back to the highest role', () => {
	expect(normalizeSortOrder('lowest')).toBe('lowest');
	expect(normalizeSortOrder('highest')).toBe('highest');
	expect(normalizeSortOrder(1)).toBe('highest');
	expect(normalizeSortOrder(undefined)).toBe('highest');
});

test('toggles between the two orders', () => {
	expect(toggleSortOrder('highest')).toBe('lowest');
	expect(toggleSortOrder('lowest')).toBe('highest');
});
