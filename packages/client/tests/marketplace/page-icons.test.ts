import { describe, expect, test } from 'bun:test';

import { isPageIcon } from '~/marketplace/page-icons';

describe('page icons', () => {
	test('a name outside the set stays text', () => {
		expect(isPageIcon('gear')).toBe(true);
		expect(isPageIcon('smile')).toBe(false);
		expect(isPageIcon('toString')).toBe(false);
	});
});
