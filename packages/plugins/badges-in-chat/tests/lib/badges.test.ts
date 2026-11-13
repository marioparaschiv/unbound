import { describe, expect, test } from 'bun:test';

import { badgeIcon } from '~/lib/badges';

const badges = [
	{ id: 'legacy_username', description: 'Originally known as x', icon: 'aaa' },
	{ id: 'verified_developer', description: 'Early Verified Bot Developer', icon: 'bbb' },
];

describe('badge icon', () => {
	test('uses the first badge the user did not hide', () => {
		expect(badgeIcon(badges, ['legacy_username'])).toEqual({
			source: 'https://cdn.discordapp.com/badge-icons/bbb.png',
			name: 'Early Verified Bot Developer',
			size: 18,
			alt: 'Early Verified Bot Developer',
		});
	});

	test('shows nothing without a profile or badges left', () => {
		expect(badgeIcon(undefined, [])).toBeUndefined();
		expect(badgeIcon(badges, ['legacy_username', 'verified_developer'])).toBeUndefined();
	});
});
