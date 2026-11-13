import { describe, expect, test } from 'bun:test';

import { friendsSinceDate } from '~/lib/since';

describe('friends since', () => {
	test('writes the day the friendship began', () => {
		expect(friendsSinceDate('2020-12-08T08:32:12.603000+00:00', 'en-GB')).toBe('8 Dec 2020');
		expect(friendsSinceDate('2020-12-08T08:32:12.603000+00:00', 'en-US')).toBe('Dec 8, 2020');
	});

	test('leaves out a missing or unreadable date', () => {
		expect(friendsSinceDate(undefined)).toBeUndefined();
		expect(friendsSinceDate('not a date')).toBeUndefined();
	});
});
