import { describe, expect, test } from 'bun:test';

import { badgesFor, type BadgeOptions } from '~/lib/badges';

const all: BadgeOptions = { nsfw: true, locked: true, rules: true, type: true, oneBadge: false };

describe('badgesFor', () => {
	test('lists locked, NSFW, rules, then the type', () => {
		const labels = badgesFor(
			{ id: '1', type: 5, nsfw: true, locked: true, isRules: true },
			all,
		).map((badge) => badge.label);

		expect(labels).toEqual(['BADGE_LOCKED', 'BADGE_NSFW', 'BADGE_RULES', 'BADGE_ANNOUNCEMENT']);
	});

	test('keeps only the first badge when asked', () => {
		expect(
			badgesFor(
				{ id: '1', type: 0, nsfw: true, locked: false, isRules: false },
				{ ...all, oneBadge: true },
			),
		).toEqual([{ label: 'BADGE_NSFW', color: '#e91e63' }]);
	});

	test('shows nothing for a plain channel with type badges off', () => {
		expect(
			badgesFor({ id: '1', type: 0, locked: false, isRules: false }, { ...all, type: false }),
		).toEqual([]);
	});
});
