import { describe, expect, test } from 'bun:test';

import { daysUntilExpiry, profileExpiry, shouldWarnAboutExpiry } from '~/core/profile-expiry';

describe('profile expiry', () => {
	test('reads the date from the install details', () => {
		expect(
			profileExpiry('Development (`ABCDE12345`) · exp 2027-09-16 · AltStore/SideStore'),
		).toBe('2027-09-16');
		expect(profileExpiry('Distribution (`53Q6R32WPB`)')).toBeUndefined();
	});

	test('counts the days left to the end of the expiry day', () => {
		const now = Date.parse('2026-11-14T12:00:00Z');

		expect(daysUntilExpiry('2026-11-14', now)).toBe(0);
		expect(daysUntilExpiry('2026-11-17', now)).toBe(3);
		expect(daysUntilExpiry('2026-11-13', now)).toBe(-1);
	});

	test('warns within a week, once per day, never after it expired', () => {
		expect(shouldWarnAboutExpiry(3, '2026-11-14', '')).toBe(true);
		expect(shouldWarnAboutExpiry(3, '2026-11-14', '2026-11-14')).toBe(false);
		expect(shouldWarnAboutExpiry(8, '2026-11-14', '')).toBe(false);
		expect(shouldWarnAboutExpiry(-1, '2026-11-14', '')).toBe(false);
	});
});
