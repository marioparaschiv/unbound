import { expect, test } from 'bun:test';

import { toggleSortOrder } from '~/viewer/permissions/sort-order';

test('toggles between the two orders', () => {
	expect(toggleSortOrder('highest')).toBe('lowest');
	expect(toggleSortOrder('lowest')).toBe('highest');
});
