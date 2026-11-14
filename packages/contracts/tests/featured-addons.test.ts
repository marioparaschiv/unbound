import { describe, expect, test } from 'bun:test';

import { pickFeatured, type FeaturedCandidate } from '~/featured-addons';

const NOW = Date.parse('2026-11-09T12:00:00.000Z');

function listing(index: number, iconSvg: string | null = '<svg/>'): FeaturedCandidate {
	return { id: `a.plugin${index}`, type: 'plugin', iconSvg };
}

describe('pickFeatured', () => {
	const many = Array.from({ length: 14 }, (_, index) =>
		listing(index, index < 12 ? '<svg/>' : null),
	);

	test('picks up to ten addons with an icon, the same all day', () => {
		const picks = pickFeatured(many, 'plugin', NOW);

		expect(picks).toHaveLength(10);
		expect(picks.every((addon) => addon.iconSvg)).toBe(true);
		expect(pickFeatured(many, 'plugin', NOW + 3_600_000)).toEqual(picks);
	});

	test('changes its order on another day', () => {
		const today = pickFeatured(many, 'plugin', NOW).map((addon) => addon.id);
		const tomorrow = pickFeatured(many, 'plugin', NOW + 86_400_000).map((addon) => addon.id);

		expect(tomorrow).not.toEqual(today);
	});

	test('falls back to every addon when too few have an icon', () => {
		const bare = Array.from({ length: 9 }, (_, index) => listing(index, null));

		expect(pickFeatured(bare, 'plugin', NOW)).toHaveLength(9);
	});

	test('shows no shelf for a kind with few addons', () => {
		expect(pickFeatured(many.slice(0, 7), 'plugin', NOW)).toEqual([]);
		expect(pickFeatured(many, 'theme', NOW)).toEqual([]);
	});
});
