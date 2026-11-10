import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { MetroFilter } from '~/metro/filters';
import type { ModuleHint } from '~/metro/cache';

import { startFakeMetro, type FakeFactory } from '../helpers/fake-metro';
import { createCacheMock } from '../helpers/cache';

type Asset = {
	name: string;
};

const REGISTRY = 1;
const TRACKER = 2;

const cachedIds: Record<string, number[]> = {};
// Each key's module ids in an earlier Discord build.
const hints: Record<string, ModuleHint[]> = {};

Object.assign(globalThis, {
	window: globalThis,
	ErrorUtils: { getGlobalHandler: () => undefined, setGlobalHandler: () => undefined },
});

// A fake Metro registry laid out like Discord's: asset modules require only the asset registry, and
// every Discord-authored module requires the import tracker to report its file path.
const fakeMetro = startFakeMetro();
const metroRequire = fakeMetro.require;
const moduleIds: number[] = [];

function define(id: number, dependencyMap: number[], factory: FakeFactory) {
	fakeMetro.define(id, dependencyMap, factory);
	moduleIds.push(id);
}

function defineAsset(id: number) {
	define(id, [REGISTRY], (_, require, ___, ____, module, _____, deps) => {
		module.exports = require(deps[0]).registerAsset({ name: `asset${id}` });
	});
}

function defineDiscord(id: number, path: string, exports: MetroExport) {
	define(id, [TRACKER], (_, require, ___, ____, module, _____, deps) => {
		module.exports = exports;
		require(deps[0]).fileFinishedImporting(path);
	});
}

define(REGISTRY, [], (_, __, ___, ____, module) => {
	const list: Asset[] = [];

	module.exports = {
		registerAsset: (asset: Asset) => list.push(asset),
		getAssetByID: () => null,
	};
});
define(TRACKER, [], (_, __, ___, ____, module) => {
	module.exports = { fileFinishedImporting: () => undefined };
});
define(3, [], (_, __, ___, ____, module) => {
	module.exports = { getPublicInstanceFromRootTag: () => null };
});
defineAsset(10);
defineAsset(11);
define(12, [], (_, __, ___, ____, module) => {
	module.exports = { thirdParty: true };
});
defineDiscord(13, 'modules/before.tsx', { before: true });
defineAsset(14);
defineDiscord(15, 'modules/wanted.tsx', { wanted: true });
defineDiscord(16, 'modules/after.tsx', { after: true });

// A block of modules whose ids moved up by 2 since an earlier build.
for (let id = 20; id < 40; id++) {
	defineDiscord(id, `modules/m${id}.tsx`, { [`module${id}`]: true });
}

// Two Discord modules one filter matches, such as a component and the index that re-exports it.
defineDiscord(41, 'modules/twin-a.tsx', { twin: 'a' });
defineDiscord(43, 'modules/twin-b.tsx', { twin: 'b' });
define(45, [], (_, __, ___, ____, module) => {
	module.exports = { pathless: 'kept' };
});
define(47, [], (_, __, ___, ____, module) => {
	module.exports = { pathless: 'other' };
});
defineDiscord(60, 'modules/cached-a.tsx', { cachedA: true });
defineDiscord(61, 'modules/cached-b.tsx', { cachedB: true });

// Discord's startup loads the registries and the renderer before Unbound runs.
metroRequire(REGISTRY);
metroRequire(TRACKER);
metroRequire(3);

const modules = globalThis.modules;

mock.module('~/metro/cache', () =>
	createCacheMock({
		state: { moduleFlags: {} },
		getModuleIds: () => moduleIds,
		hasModuleFlag: () => false,
		addModuleFlag: () => undefined,
		getModuleCacheForKey: (key: string) => cachedIds[key],
		isKeyMissing: (key?: string) => key !== void 0 && cachedIds[key]?.length === 0,
		getHintsForKey: (key: string) => hints[key],
		addCachedIDForKey(key: string, id: number) {
			cachedIds[key] ??= [];
			cachedIds[key].push(id);
		},
		markKeyMissing(key: string) {
			cachedIds[key] = [];
		},
	}),
);

const metro = await import('~/metro/search');
const lookups = await import('~/metro/lookups');
const { CACHE_KEY } = await import('~/metro/cache-key');

function initialized() {
	return moduleIds.filter((id) => modules.get(id)?.isInitialized);
}

function loadedBy(search: () => void) {
	const before = initialized();

	search();

	return initialized().filter((id) => !before.includes(id));
}

beforeEach(() => {
	for (const key of Object.keys(cachedIds)) delete cachedIds[key];
});

describe('a forcing search', () => {
	test('reaches a module by path without loading asset or third-party modules before it', () => {
		let found: MetroExport;

		expect(
			loadedBy(() => (found = lookups.findByFilePath('modules/wanted.tsx', { lazy: false }))),
		).toEqual([13, 15]);
		expect(found?.wanted).toBe(true);
	});

	test('reaches a module by props without loading asset modules before it', () => {
		let found: MetroExport;

		expect(loadedBy(() => (found = lookups.findByProps('after', { lazy: false })))).toEqual([
			12, 16,
		]);
		expect(found?.after).toBe(true);
	});
});

describe('a forcing search with a hint from an earlier build', () => {
	test('loads only the modules around the old id until it matches', () => {
		hints['byProps::module25'] = [{ id: 23, path: 'modules/m25.tsx' }];

		expect(loadedBy(() => lookups.findByProps('module25', { lazy: false }))).toEqual([
			22, 23, 24, 25,
		]);
		expect(cachedIds['byProps::module25']).toEqual([25]);
	});

	test("tries a nearby module's move first", () => {
		hints['byProps::module30'] = [{ id: 28, path: 'modules/m30.tsx' }];

		expect(loadedBy(() => lookups.findByProps('module30', { lazy: false }))).toEqual([30]);
	});

	test('falls back to the whole registry when nothing near the old id matches', () => {
		hints['byProps::module39'] = [{ id: 3, path: 'modules/m39.tsx' }];

		expect(lookups.findByProps('module39', { lazy: false })?.module39).toBe(true);
	});

	test('returns the module from the same file, not another the filter matches', () => {
		hints['byProps::twin'] = [{ id: 39, path: 'modules/twin-b.tsx' }];

		expect(lookups.findByProps('twin', { lazy: false })?.twin).toBe('b');
	});

	test('tries a module without a file path at its old id alone', () => {
		hints['byProps::pathless'] = [{ id: 45 }];

		let found: MetroExport;

		expect(loadedBy(() => (found = lookups.findByProps('pathless', { lazy: false })))).toEqual([
			45,
		]);
		expect(found?.pathless).toBe('kept');
	});
});

describe('a search with cached ids', () => {
	function countingFilter(key: string, matches: (mdl: MetroExport) => boolean) {
		const tested: number[] = [];
		const filter: MetroFilter = (mdl, id) => {
			tested.push(Number(id));

			return matches(mdl);
		};

		filter[CACHE_KEY] = key;

		return { filter, tested };
	}

	test('tests only the cached module, initializing it, without scanning the registry', () => {
		cachedIds['custom::cachedA'] = [60];

		const { filter, tested } = countingFilter('custom::cachedA', (mdl) => mdl?.cachedA);
		let found: MetroExport;

		expect(loadedBy(() => (found = metro.find(filter)))).toEqual([60]);
		expect(found?.cachedA).toBe(true);
		expect(tested).toEqual([60]);
	});

	test('returns nothing without scanning when the cached module is not loaded and initializing is off', () => {
		cachedIds['custom::cachedB'] = [61];

		const { filter, tested } = countingFilter('custom::cachedB', (mdl) => mdl?.cachedB);

		expect(metro.find(filter, { initialize: false })).toBeNull();
		expect(tested).toEqual([]);
		expect(modules.get(61)?.isInitialized).toBe(false);
	});
});
