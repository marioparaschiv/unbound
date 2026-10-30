import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { ManagerKind } from '@unbound-app/types/addons';
import { describe, expect, test } from 'bun:test';

import type { MarketplaceState } from '~/lib/catalog';

import type { LinkTargets } from './resolve-unbound-link';

import resolveUnboundLink from './resolve-unbound-link';

function listing(id: string, version: string): ListedAddon {
	return {
		id,
		type: 'plugin',
		latestVersion: {
			version,
			manifest: {
				id,
				name: id,
				description: 'An addon.',
				authors: [{ name: 'Mario', id: '1234567890' }],
				version,
				main: 'index.js',
				type: 'plugin',
			},
			changelog: null,
			changes: null,
			source: null,
			bundleSize: 10,
			sha256: 'a'.repeat(64),
			publishedAt: '2026-10-01T00:00:00.000Z',
			manifestUrl: `https://cdn.example.com/addons/${id}/${version}/manifest.json`,
			bundleUrl: `https://cdn.example.com/addons/${id}/${version}/index.js`,
		},
	};
}

function ready(addons: ListedAddon[]): MarketplaceState {
	return { status: 'ready', catalog: { revision: 'r1', addons }, refreshing: false };
}

type Fixture = {
	afterEachFetch: MarketplaceState[];
	installed?: Record<string, string>;
};

function targets({ afterEachFetch, installed = {} }: Fixture) {
	const opened: [ManagerKind, string][] = [];
	let current: MarketplaceState = { status: 'idle' };
	let next = 0;

	function advance() {
		current = afterEachFetch[Math.min(next++, afterEachFetch.length - 1)] ?? current;

		return Promise.resolve(current.status === 'ready');
	}

	const stub: LinkTargets = {
		load: advance,
		refresh: advance,
		state: () => current,
		kindOf: (type) => (type === 'plugin' ? 'plugins' : undefined),
		installedVersion: (_kind, addon) => installed[addon.id],
		open: (kind, id) => {
			opened.push([kind, id]);

			return Promise.resolve();
		},
	};

	return { stub, opened };
}

const LINK = { action: 'install', id: 'acme.hello' } as const;

describe('resolveUnboundLink', () => {
	test('opens the Marketplace on a listed addon that is not installed', async () => {
		const addon = listing('acme.hello', '1.0.0');
		const { stub, opened } = targets({ afterEachFetch: [ready([addon])] });

		expect(await resolveUnboundLink(LINK, stub)).toEqual({
			type: 'opened',
			addon,
			kind: 'plugins',
		});
		expect(opened).toEqual([['plugins', 'acme.hello']]);
	});

	test('opens the Marketplace to update an older installed copy', async () => {
		const addon = listing('acme.hello', '1.1.0');
		const { stub, opened } = targets({
			afterEachFetch: [ready([addon])],
			installed: { 'acme.hello': '1.0.0' },
		});

		expect((await resolveUnboundLink(LINK, stub)).type).toBe('opened');
		expect(opened).toEqual([['plugins', 'acme.hello']]);
	});

	test('finds an addon published after the stored catalog by refreshing once', async () => {
		const addon = listing('acme.hello', '1.0.0');
		const { stub, opened } = targets({ afterEachFetch: [ready([]), ready([addon])] });

		expect((await resolveUnboundLink(LINK, stub)).type).toBe('opened');
		expect(opened).toEqual([['plugins', 'acme.hello']]);
	});

	test('reports an addon the catalog does not list, without navigating', async () => {
		const { stub, opened } = targets({
			afterEachFetch: [ready([listing('acme.other', '1.0.0')])],
		});

		expect(await resolveUnboundLink(LINK, stub)).toEqual({ type: 'missing', id: 'acme.hello' });
		expect(opened).toEqual([]);
	});

	test('reports an addon that is already current, without navigating', async () => {
		const addon = listing('acme.hello', '1.0.0');
		const { stub, opened } = targets({
			afterEachFetch: [ready([addon])],
			installed: { 'acme.hello': '1.0.0' },
		});

		expect(await resolveUnboundLink(LINK, stub)).toEqual({ type: 'current', addon });
		expect(opened).toEqual([]);
	});

	test('reports being offline when no catalog could be read or fetched', async () => {
		const { stub, opened } = targets({
			afterEachFetch: [{ status: 'failed', error: 'offline' }],
		});

		expect(await resolveUnboundLink(LINK, stub)).toEqual({ type: 'offline', id: 'acme.hello' });
		expect(opened).toEqual([]);
	});
});
