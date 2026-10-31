import type { AddonType, ListedAddon } from '@unbound-app/contracts/addons';
import { describe, expect, test } from 'bun:test';

import type { MarketplaceEvent, MarketplaceState } from './catalog';

import { getInstallStatus, parseCatalog, queryCatalog, reduceMarketplace } from './catalog';

type ListingOptions = {
	type?: AddonType;
	name?: string;
	description?: string;
	author?: string;
	publishedAt?: string;
};

function listing(id: string, options: ListingOptions = {}): ListedAddon {
	const {
		type = 'plugin',
		name = id,
		description = 'An addon.',
		author = 'Mario',
		publishedAt = '2026-10-01T00:00:00.000Z',
	} = options;

	return {
		id,
		type,
		latestVersion: {
			version: '1.0.0',
			manifest: {
				id,
				name,
				description,
				authors: [{ name: author, id: '1234567890' }],
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
	listing('a.zeta', { name: 'Zeta', publishedAt: '2026-10-03T00:00:00.000Z' }),
	listing('a.alpha', { name: 'alpha', description: 'Hides typing.' }),
	listing('a.beta', { name: 'Beta', author: 'Noelle', publishedAt: '2026-10-02T00:00:00.000Z' }),
	listing('a.midnight', { name: 'Midnight', type: 'theme' }),
];

describe('queryCatalog', () => {
	test('keeps one type, sorted by name case-insensitively', () => {
		const ids = queryCatalog(addons, { type: 'plugin' }).map((addon) => addon.id);

		expect(ids).toEqual(['a.alpha', 'a.beta', 'a.zeta']);
		expect(queryCatalog(addons, { type: 'theme' }).map((addon) => addon.id)).toEqual([
			'a.midnight',
		]);
		expect(queryCatalog(addons, { type: 'font' })).toEqual([]);
	});

	test('searches name, description, author and id, ignoring case and padding', () => {
		const search = (text: string) =>
			queryCatalog(addons, { type: 'plugin', search: text }).map((addon) => addon.id);

		expect(search('  ZET ')).toEqual(['a.zeta']);
		expect(search('typing')).toEqual(['a.alpha']);
		expect(search('noelle')).toEqual(['a.beta']);
		expect(search('a.b')).toEqual(['a.beta']);
		expect(search('midnight')).toEqual([]);
	});

	test('sorts by most recently published', () => {
		const ids = queryCatalog(addons, { type: 'plugin', sort: 'updated' }).map(
			(addon) => addon.id,
		);

		expect(ids).toEqual(['a.zeta', 'a.beta', 'a.alpha']);
	});

	test('does not reorder the stored catalog', () => {
		const before = addons.map((addon) => addon.id);

		queryCatalog(addons, { type: 'plugin' });

		expect(addons.map((addon) => addon.id)).toEqual(before);
	});
});

describe('getInstallStatus', () => {
	test('offers install, update or nothing', () => {
		expect(getInstallStatus('1.1.0', undefined)).toBe('install');
		expect(getInstallStatus('1.1.0', '1.0.0')).toBe('update');
		expect(getInstallStatus('1.1.0', '1.1.0')).toBe('installed');
		expect(getInstallStatus('1.1.0', '2.0.0')).toBe('installed');
	});
});

describe('parseCatalog', () => {
	test('accepts a whole catalog and rejects a torn or foreign one', () => {
		const text = JSON.stringify({ revision: 'r1', addons });

		expect(parseCatalog(text)?.addons).toHaveLength(4);
		expect(parseCatalog(text.slice(0, -10))).toBeUndefined();
		expect(parseCatalog('{"revision":"r1"}')).toBeUndefined();
	});
});

function run(events: MarketplaceEvent[]): MarketplaceState {
	return events.reduce<MarketplaceState>(reduceMarketplace, { status: 'idle' });
}

describe('reduceMarketplace', () => {
	const stale = { revision: 'r1', addons };
	const fresh = { revision: 'r2', addons: addons.slice(1) };

	test('shows the stored copy while it refreshes, then the fetched one', () => {
		expect(run([{ type: 'stored', catalog: stale }, { type: 'refreshing' }])).toEqual({
			status: 'ready',
			catalog: stale,
			refreshing: true,
		});
		expect(
			run([
				{ type: 'stored', catalog: stale },
				{ type: 'refreshing' },
				{ type: 'fetched', catalog: fresh },
			]),
		).toEqual({ status: 'ready', catalog: fresh, refreshing: false });
	});

	test('keeps the stored copy when the server has nothing newer or cannot be reached', () => {
		for (const ending of [
			{ type: 'not-modified' },
			{ type: 'failed', error: 'offline' },
		] as const) {
			expect(
				run([{ type: 'stored', catalog: stale }, { type: 'refreshing' }, ending]),
			).toEqual({
				status: 'ready',
				catalog: stale,
				refreshing: false,
			});
		}
	});

	test('fails only when nothing is stored, and recovers on the next refresh', () => {
		const failed = run([
			{ type: 'stored', catalog: undefined },
			{ type: 'refreshing' },
			{ type: 'failed', error: 'offline' },
		]);

		expect(failed).toEqual({ status: 'failed', error: 'offline' });
		expect(reduceMarketplace(failed, { type: 'refreshing' })).toEqual({ status: 'loading' });
	});
});
