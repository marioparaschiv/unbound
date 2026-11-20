import { describe, expect, test } from 'bun:test';

import { roleChanges } from '~/lib/role-changes';

describe('roleChanges', () => {
	test('lists the roles added and removed', () => {
		expect(roleChanges(['a', 'b'], ['b', 'c'])).toEqual({ gained: ['c'], lost: ['a'] });
	});

	test('finds nothing when only the order changes', () => {
		expect(roleChanges(['a', 'b'], ['b', 'a'])).toEqual({ gained: [], lost: [] });
	});
});
