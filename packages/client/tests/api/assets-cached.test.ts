import type { DiscordAsset } from '@unbound-app/types/assets';
import { describe, expect, test, mock } from 'bun:test';

import {
	type ModuleFactory,
	type SettingsRoot,
	installMetroGlobals,
} from '../helpers/metro-fixture';

const ASSET_IDS = { cached: 201, uncached: 202, stale: 203 } as const;

const objectExport = { name: 'ObjectExport', type: 'png' };

const table = new Map<unknown, DiscordAsset>([
	[ASSET_IDS.cached, makeAsset('Cached', 'png')],
	[ASSET_IDS.uncached, makeAsset('Uncached', 'png')],
	[objectExport, makeAsset('ObjectExport', 'png')],
]);

function makeAsset(name: string, type: string): DiscordAsset {
	return { name, type, width: 24, height: 24, scales: [1], hash: `${name}-${type}` };
}

function exporting(value: unknown): ModuleFactory {
	return (_g, _r, _d, _a, moduleObject) => {
		moduleObject.exports = value as never;
	};
}

installMetroGlobals({
	modules: {
		1: { factory: exporting(ASSET_IDS.cached) },
		2: { factory: exporting(ASSET_IDS.uncached) },
		3: { factory: exporting(ASSET_IDS.stale) },
		4: {
			factory: () => {
				throw new Error('module init blew up');
			},
		},
		5: { factory: exporting(objectExport) },
	},
});

const settings = globalThis.UNBOUND_SETTINGS as SettingsRoot;

// Cached ids 1, 3, 4 and 5 are walked; module 2 is a live asset module the warm path must never see.
settings['unbound::cache'] = {
	info: { cacheVersion: 1, buildNumber: '1', moduleCount: 5 },
	modules: {},
	moduleFlags: {},
	assets: [1, 3, 4, 5],
};

mock.module('~/api/metro/common', () => ({
	Assets: {
		// RN's real implementation is an unguarded table lookup, so a non-number id is not rejected on
		// its way in - it simply reads whatever the key happens to hit.
		getAssetByID: (id: number): DiscordAsset | null => table.get(id) ?? null,
	},
}));

const Assets = await import('~/api/assets');

describe('warm cache walk', () => {
	test('only cached module ids are walked', () => {
		expect(Assets.getByID(ASSET_IDS.cached)?.name).toBe('Cached');
		expect(Assets.getByID(ASSET_IDS.uncached)).toBeUndefined();
	});

	test('a cached id whose asset no longer resolves is skipped', () => {
		expect(Assets.getByID(ASSET_IDS.stale)).toBeUndefined();
	});

	test('a cached id whose module throws on init is skipped rather than aborting the walk', () => {
		// Module 4 throws and is cached ahead of module 5, so module 5's asset only lands if the walk
		// survived the throw.
		expect(Assets.getByName('ObjectExport')).toBeDefined();
	});

	test('FINDING: the warm path registers a non-number export, keyed by the export object itself', () => {
		// The cold walk guards with `typeof exported !== 'number'`; the warm walk has no such guard, so
		// a cached id whose module exports a non-number is still handed to `getAssetByID` and, on a
		// truthy result, stored under a key that is not a number. That key can never be reached through
		// `getByID(id: number)`, and `getAll`/`find` then surface an asset with no addressable id.
		// Correct behaviour is for the warm path to apply the same type guard and skip the entry.
		// The declared key type is `number`, so the offending key is only observable by widening the
		// iterable back to what the Map actually holds at runtime.
		const keys: unknown[] = [...Assets.assets.keys()];
		const objectKeyed = keys.filter((key) => typeof key !== 'number');

		expect(objectKeyed).toEqual([objectExport]);
		expect(Assets.getByName('ObjectExport')).toBeDefined();
		expect(Assets.getIDByName('ObjectExport')).not.toBeNumber();
	});
});
