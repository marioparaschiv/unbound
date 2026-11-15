import { describe, expect, test } from 'bun:test';

import { isNewMember, sproutIcon } from '~/lib/sprout';

const NOW = Date.parse('2026-11-16T12:00:00Z');

describe('isNewMember', () => {
	test('counts members who joined within the window', () => {
		expect(isNewMember('2026-11-14T12:00:00Z', 7, NOW)).toBe(true);
		expect(isNewMember('2026-11-08T12:00:00Z', 7, NOW)).toBe(false);
	});

	test('ignores missing, invalid and future join dates', () => {
		expect(isNewMember(undefined, 7, NOW)).toBe(false);
		expect(isNewMember('soon', 7, NOW)).toBe(false);
		expect(isNewMember('2026-11-20T12:00:00Z', 7, NOW)).toBe(false);
	});
});

describe('sproutIcon', () => {
	test('draws the sprout emoji at role-icon size', () => {
		expect(sproutIcon('New')).toEqual({
			unicodeEmoji: '🌱',
			name: 'New',
			size: 18,
			alt: 'New',
		});
	});
});
