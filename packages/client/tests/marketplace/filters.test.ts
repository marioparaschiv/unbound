import type { AddonType, ListedAddon } from '@unbound-app/contracts/addons';
import { describe, expect, test } from 'bun:test';

import {
	countActiveFilters,
	DEFAULT_FILTERS,
	filterCatalog,
	listAuthors,
	listTags,
	pickFeatured,
} from '~/marketplace/filters';
import type { MarketplaceFilters } from '~/marketplace/filters';

type ListingOptions = {
	type?: AddonType;
	authors?: [`${number}`, string][];
	publishedAt?: string;
	iconSvg?: string;
	tags?: string[];
};

const NOW = Date.parse('2026-11-09T12:00:00.000Z');

function listing(id: string, options: ListingOptions = {}): ListedAddon {
	const {
		type = 'plugin',
		authors = [['1', 'Mario']],
		publishedAt = '2026-11-08T00:00:00.000Z',
		iconSvg,
		tags,
	} = options;

	return {
		id,
		type,
		iconSvg,
		tags: tags?.map((tag) => ({ id: tag, label: tag.toUpperCase(), color: '#fff' })),
		latestVersion: {
			version: '1.0.0',
			manifest: {
				id,
				name: id,
				description: 'An addon.',
				authors: authors.map(([authorId, name]) => ({ id: authorId, name })),
				version: '1.0.0',
				main: 'index.js',
				type,
			},
			changelog: null,
			changes: null,
			source: null,
			bundleSize: 10,
			sha256: 'a'.repeat(64),
			publishedAt,
			manifestUrl: `https://cdn.example.com/addons/${id}/1.0.0/manifest.json`,
			bundleUrl: `https://cdn.example.com/addons/${id}/1.0.0/index.js`,
		},
	};
}

const addons = [
	listing('a.solo', { authors: [['1', 'Mario']], tags: ['chat', 'privacy'] }),
	listing('a.pair', {
		authors: [
			['1', 'Mario'],
			['2', 'Noelle'],
		],
		publishedAt: '2026-06-01T00:00:00.000Z',
		tags: ['chat'],
	}),
	listing('a.other', { authors: [['2', 'Noelle']], publishedAt: '2025-01-01T00:00:00.000Z' }),
	listing('a.theme', { type: 'theme', authors: [['3', 'Rosie']], tags: ['dark'] }),
];

function ids(filters: Partial<MarketplaceFilters>): string[] {
	return filterCatalog(addons, { ...DEFAULT_FILTERS, ...filters }, NOW).map((addon) => addon.id);
}

describe('filterCatalog', () => {
	test('keeps everything by default, in order', () => {
		expect(ids({})).toEqual(['a.solo', 'a.pair', 'a.other', 'a.theme']);
	});

	test('keeps addons carrying any, all or none of the picked tags', () => {
		expect(ids({ tags: ['chat', 'privacy'] })).toEqual(['a.solo', 'a.pair']);
		expect(ids({ tags: ['chat', 'privacy'], tagMatch: 'all' })).toEqual(['a.solo']);
		expect(ids({ tags: ['chat'], tagMatch: 'none' })).toEqual(['a.other', 'a.theme']);
	});

	test('keeps addons any picked author wrote, or drops them with none', () => {
		expect(ids({ authors: ['2'] })).toEqual(['a.pair', 'a.other']);
		expect(ids({ authors: ['2'], authorMatch: 'none' })).toEqual(['a.solo', 'a.theme']);
	});

	test('keeps addons published within the window, or before it with none', () => {
		expect(ids({ updated: 7 })).toEqual(['a.solo', 'a.theme']);
		expect(ids({ updated: 365, updatedMatch: 'none' })).toEqual(['a.other']);
	});

	test('applies both filters together', () => {
		expect(ids({ authors: ['1'], updated: 365 })).toEqual(['a.solo', 'a.pair']);
	});
});

describe('countActiveFilters', () => {
	test('counts tags, authors and updated, not the sort', () => {
		expect(countActiveFilters({ ...DEFAULT_FILTERS, sort: 'updated' })).toBe(0);
		expect(countActiveFilters({ ...DEFAULT_FILTERS, authors: ['1'], updated: 30 })).toBe(2);
		expect(countActiveFilters({ ...DEFAULT_FILTERS, tags: ['chat'], updated: 30 })).toBe(2);
	});
});

describe('listAuthors', () => {
	test("counts one kind's authors, the most prolific first", () => {
		expect(listAuthors(addons, 'plugin')).toEqual([
			{ id: '1', name: 'Mario', count: 2 },
			{ id: '2', name: 'Noelle', count: 2 },
		]);
		expect(listAuthors(addons, 'theme')).toEqual([{ id: '3', name: 'Rosie', count: 1 }]);
	});
});

describe('listTags', () => {
	test("counts one kind's tags, the most used first", () => {
		expect(listTags(addons, 'plugin')).toEqual([
			{ id: 'chat', label: 'CHAT', color: '#fff', count: 2 },
			{ id: 'privacy', label: 'PRIVACY', color: '#fff', count: 1 },
		]);
		expect(listTags([listing('a.bare')], 'plugin')).toEqual([]);
	});
});

describe('pickFeatured', () => {
	const many = Array.from({ length: 14 }, (_, index) =>
		listing(`a.plugin${index}`, { iconSvg: index < 12 ? '<svg/>' : undefined }),
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

	test('shows no shelf for a kind with few addons', () => {
		expect(pickFeatured(addons, 'plugin', NOW)).toEqual([]);
	});
});
