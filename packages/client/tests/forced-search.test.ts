import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { ModuleHint } from '~/metro/cache';

type Factory = (
	global: typeof globalThis,
	require: (id: number) => MetroExport,
	importDefault: (id: number) => MetroExport,
	importAll: (id: number) => MetroExport,
	module: MetroPublicModule,
	exports: MetroExport,
	dependencyMap: number[],
) => void;

type Asset = {
	name: string;
};

const REGISTRY = 1;
const TRACKER = 2;

const cachedIds: Record<string, number[]> = {};
// Each key's module ids in an earlier Discord build.
const hints: Record<string, ModuleHint[]> = {};

Object.assign(globalThis, {
	$$DEV$$: false,
	window: globalThis,
	ErrorUtils: { getGlobalHandler: () => undefined, setGlobalHandler: () => undefined },
});

// A fake Metro registry laid out like Discord's: asset modules require only the asset registry, and
// every Discord-authored module requires the import tracker to report its file path.
const modules = new Map<number, MetroModuleRecord>();
const moduleIds: number[] = [];

function define(id: number, dependencyMap: number[], factory: Factory) {
	modules.set(id, {
		factory,
		dependencyMap,
		isInitialized: false,
		publicModule: { id, exports: {} },
	});
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

function metroRequire(id: number): MetroExport {
	const record = modules.get(id);

	if (!record) {
		throw new Error(`No module ${id}`);
	}

	if (!record.isInitialized) {
		record.isInitialized = true;
		record.factory?.(
			globalThis,
			metroRequire,
			metroRequire,
			metroRequire,
			record.publicModule,
			record.publicModule.exports,
			record.dependencyMap ?? [],
		);
		record.factory = undefined;
		record.dependencyMap = undefined;
	}

	return record.publicModule.exports;
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

// Discord's startup loads the registries and the renderer before Unbound runs.
metroRequire(REGISTRY);
metroRequire(TRACKER);
metroRequire(3);

Object.assign(globalThis, { modules, __r: metroRequire });

mock.module('~/metro/cache', () => ({
	ModuleFlags: { BLACKLISTED: 1 },
	default: {
		moduleIds,
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
	},
}));

const metro = await import('~/metro/search');

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

		expect(loadedBy(() => (found = metro.findByFilePath('modules/wanted.tsx')))).toEqual([
			13, 15,
		]);
		expect(found?.wanted).toBe(true);
	});

	test('reaches a module by props without loading asset modules before it', () => {
		let found: MetroExport;

		expect(loadedBy(() => (found = metro.findByProps('after')))).toEqual([12, 16]);
		expect(found?.after).toBe(true);
	});
});

describe('a forcing search with a hint from an earlier build', () => {
	test('loads only the modules around the old id until it matches', () => {
		hints['byProps::module25'] = [{ id: 23, path: 'modules/m25.tsx' }];

		expect(loadedBy(() => metro.findByProps('module25'))).toEqual([22, 23, 24, 25]);
		expect(cachedIds['byProps::module25']).toEqual([25]);
	});

	test("tries a nearby module's move first", () => {
		hints['byProps::module30'] = [{ id: 28, path: 'modules/m30.tsx' }];

		expect(loadedBy(() => metro.findByProps('module30'))).toEqual([30]);
	});

	test('falls back to the whole registry when nothing near the old id matches', () => {
		hints['byProps::module39'] = [{ id: 3, path: 'modules/m39.tsx' }];

		expect(metro.findByProps('module39')?.module39).toBe(true);
	});

	test('returns the module from the same file, not another the filter matches', () => {
		hints['byProps::twin'] = [{ id: 39, path: 'modules/twin-b.tsx' }];

		expect(metro.findByProps('twin')?.twin).toBe('b');
	});

	test('tries a module without a file path at its old id alone', () => {
		hints['byProps::pathless'] = [{ id: 45 }];

		let found: MetroExport;

		expect(loadedBy(() => (found = metro.findByProps('pathless')))).toEqual([45]);
		expect(found?.pathless).toBe('kept');
	});
});
