import { describe, expect, mock, test } from 'bun:test';

type Asset = {
	__packager_asset: boolean;
	name: string;
	type: string;
	httpServerLocation: string;
	width: number;
	height: number;
	scales: number[];
	hash: string;
};
type Registry = {
	registerAsset: (asset: Asset) => number;
	getAssetByID: (id: number) => Asset | undefined;
};
type Factory = (
	global: typeof globalThis,
	require: (id: number) => MetroExport,
	importDefault: (id: number) => MetroExport,
	importAll: (id: number) => MetroExport,
	module: MetroPublicModule,
	exports: MetroExport,
	dependencyMap: number[],
) => void;

const REGISTRY = 83;
const REEXPORT = 1134;
const PLAIN = 7;

const cachedIds: Record<string, number[]> = {};
const cachedAssets: Record<string, number> = {};

Object.assign(globalThis, {
	$$DEV$$: false,
	window: globalThis,
	ErrorUtils: { getGlobalHandler: () => undefined, setGlobalHandler: () => undefined },
});

// A fake Metro registry laid out like Discord's: 83 holds the assets, 1134 copies its functions, and
// every asset module requires only 1134.
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

function defineAsset(id: number, name: string) {
	define(id, [REEXPORT], (_, require, ___, ____, module, _____, deps) => {
		module.exports = (require(deps[0]) as Registry).registerAsset({
			__packager_asset: true,
			name,
			type: 'png',
			httpServerLocation: '/assets/images',
			width: 24,
			height: 24,
			scales: [1, 2],
			hash: name,
		});
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

function initialized() {
	return moduleIds.filter((id) => modules.get(id)?.isInitialized);
}

function initializedSince(before: number[]) {
	return initialized().filter((id) => !before.includes(id));
}

define(REGISTRY, [], (_, __, ___, ____, module) => {
	const list: Asset[] = [];

	module.exports = {
		registerAsset: (asset: Asset) => list.push(asset),
		getAssetByID: (id: number) => list[id - 1],
	};
});
define(REEXPORT, [REGISTRY], (_, require, ___, ____, module, exports, deps) => {
	exports.registerAsset = require(deps[0]).registerAsset;
	exports.getAssetByID = require(deps[0]).getAssetByID;
});
define(PLAIN, [], (_, __, ___, ____, module) => {
	module.exports = { plain: true };
});
defineAsset(2000, 'preloaded');
defineAsset(2001, 'later');
defineAsset(2002, 'cached');
defineAsset(2003, 'decoy');
defineAsset(2004, 'swept');
define(3000, [REEXPORT, PLAIN], (_, __, ___, ____, module) => {
	module.exports = { twoDependencies: true };
});
define(3001, [PLAIN], (_, __, ___, ____, module) => {
	module.exports = { otherDependency: true };
});

// Discord's startup loads the registry and one asset before Unbound runs.
metroRequire(PLAIN);
metroRequire(2000);

Object.assign(globalThis, { modules, __r: metroRequire });

const cacheState = { assetsComplete: false };

mock.module('~/lib/cache', () => ({
	ModuleFlags: { BLACKLISTED: 1 },
	default: {
		state: cacheState,
		moduleIds,
		hasModuleFlag: () => false,
		addModuleFlag: () => undefined,
		getModuleCacheForKey: (key: string) => cachedIds[key],
		addCachedIDForKey(key: string, id: number) {
			cachedIds[key] ??= [];
			cachedIds[key].push(id);
		},
		getCachedAssetModule: (key: string) => cachedAssets[key],
		addAssetToCache(key: string, id: number) {
			cachedAssets[key] = id;
		},
		removeAssetFromCache(key: string) {
			delete cachedAssets[key];
		},
		markAssetsComplete() {
			cacheState.assetsComplete = true;
		},
	},
}));

mock.module('~/api/metro/wrappers', () => ({
	findByPropsLazy: () => ({ getPublicInstanceFromRootTag: () => null }),
}));

const loadedBeforeImport = initialized();
const assets = await import('~/api/assets');

function nameOf(id: number | undefined) {
	return id === undefined ? undefined : assets.getByID(id)?.name;
}

describe('assets', () => {
	test('initializes no module on import', () => {
		expect(initialized()).toEqual(loadedBeforeImport);
	});

	test('finds an asset registered before it loaded, without initializing anything', () => {
		expect(nameOf(assets.getIDByName('preloaded'))).toBe('preloaded');
		expect(assets.getByName('preloaded')?.name).toBe('preloaded');
		expect(initialized()).toEqual(loadedBeforeImport);
	});

	test('records an asset Discord registers, with the module that registers it', () => {
		metroRequire(2001);

		const before = initialized();

		expect(nameOf(assets.getIDByName('later'))).toBe('later');
		expect(cachedAssets['later.png']).toBe(2001);
		expect(initialized()).toEqual(before);
	});

	test('a cached name initializes only its module', () => {
		cachedAssets['cached.png'] = 2002;

		const before = initialized();

		expect(nameOf(assets.getIDByName('cached'))).toBe('cached');
		expect(initializedSince(before)).toEqual([2002]);
	});

	test('an uncached name initializes only the asset modules, dropping a stale cache entry', () => {
		cachedAssets['swept.png'] = 2003;

		const before = initialized();

		expect(nameOf(assets.getIDByName('swept'))).toBe('swept');
		expect(cachedAssets['swept.png']).toBe(2004);
		expect(initializedSince(before)).toEqual([2003, 2004]);
		expect(cacheState.assetsComplete).toBe(true);
	});

	test('after the sweep, a missing name initializes nothing', () => {
		defineAsset(2005, 'added');

		const before = initialized();

		expect(assets.getIDByName('missing')).toBeUndefined();
		expect(assets.Icons.missing).toBeUndefined();
		expect(initializedSince(before)).toEqual([]);
	});

	test('getAll returns every registered asset', () => {
		expect(assets.getAll().map((asset) => asset.name)).toEqual([
			'preloaded',
			'later',
			'cached',
			'decoy',
			'swept',
		]);
	});

	test('notifies listeners of later registrations until removed', () => {
		const seen: string[] = [];
		const stop = assets.onAssetRegistered((asset) => seen.push(asset.name));

		metroRequire(2005);
		stop();
		defineAsset(2006, 'unheard');
		metroRequire(2006);

		expect(seen).toEqual(['added']);
	});
});
