import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { startFakeMetro } from './helpers/fake-metro';

const TRACKER = 1;
const MODULE_COUNT = 200;

const cachedIds: Record<string, number[]> = {};

Object.assign(globalThis, {
	$$DEV$$: false,
	window: globalThis,
	ErrorUtils: { getGlobalHandler: () => undefined, setGlobalHandler: () => undefined },
});

// A fake Metro registry where every Discord-authored module reports its file path to the import tracker.
const fakeMetro = startFakeMetro();
const metroRequire = fakeMetro.require;

fakeMetro.define(TRACKER, [], (_, __, ___, ____, module) => {
	module.exports = { fileFinishedImporting: () => undefined };
});
fakeMetro.define(2, [], (_, __, ___, ____, module) => {
	module.exports = { getPublicInstanceFromRootTag: () => null };
});

for (let id = 10; id < 10 + MODULE_COUNT; id++) {
	fakeMetro.define(id, [TRACKER], (_, require, ___, ____, module, _____, deps) => {
		module.exports = { id };
		require(deps[0]).fileFinishedImporting(`modules/m${id}.tsx`);
	});
}

const modules = globalThis.modules;
const recordsRead = new Set<number>();
const readRecord = modules.get.bind(modules);

modules.get = (id: number) => {
	recordsRead.add(id);

	return readRecord(id);
};

mock.module('~/metro/cache', () => ({
	ModuleFlags: { BLACKLISTED: 1 },
	default: {
		state: { moduleFlags: {} },
		moduleIds: [...modules.keys()],
		hasModuleFlag: () => false,
		addModuleFlag: () => undefined,
		getModuleCacheForKey: (key: string) => cachedIds[key],
		isKeyMissing: (key?: string) => key !== void 0 && cachedIds[key]?.length === 0,
		getHintsForKey: () => undefined,
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
const { findLazy, onModuleLoaded } = await import('~/metro/wait');
const { byFilePath } = await import('~/metro/filters');

metroRequire(TRACKER);
metroRequire(2);

beforeEach(() => {
	for (const key of Object.keys(cachedIds)) delete cachedIds[key];
});

function isLoaded(id: number) {
	return Boolean(readRecord(id)?.isInitialized);
}

describe('a file path wait', () => {
	test('resolves once Discord loads the module from that file, without loading it', () => {
		const found: MetroExport[] = [];

		recordsRead.clear();
		onModuleLoaded(byFilePath('modules/m20.tsx'), (mdl) => found.push(mdl), { interop: false });

		expect([...recordsRead]).toEqual([]);
		expect(isLoaded(20)).toBe(false);

		metroRequire(21);

		expect(found).toEqual([]);

		metroRequire(20);

		expect(found).toEqual([{ id: 20 }]);
	});

	test('resolves on the path even when the cache names another module', () => {
		cachedIds['byFilePath::modules/m30.tsx'] = [31];

		const found: MetroExport[] = [];

		onModuleLoaded(byFilePath('modules/m30.tsx'), (mdl) => found.push(mdl), { interop: false });
		metroRequire(31);
		metroRequire(30);

		expect(found).toEqual([{ id: 30 }]);
	});

	test('never runs once cancelled', () => {
		const found: MetroExport[] = [];

		onModuleLoaded(byFilePath('modules/m40.tsx'), (mdl) => found.push(mdl))();
		metroRequire(40);

		expect(found).toEqual([]);
	});

	test('on a path marked missing never resolves, and findLazy settles at once', async () => {
		cachedIds['byFilePath::modules/m50.tsx'] = [];

		const found: MetroExport[] = [];

		onModuleLoaded(byFilePath('modules/m50.tsx'), (mdl) => found.push(mdl));

		const lazy = findLazy(byFilePath('modules/m50.tsx'));

		metroRequire(50);

		expect(found).toEqual([]);
		expect(await lazy).toBeUndefined();
	});
});

describe('a file path search', () => {
	test('finds a loaded module reading only its record', () => {
		metroRequire(60);
		recordsRead.clear();

		expect(metro.findByFilePath('modules/m60.tsx', { interop: false })).toEqual({ id: 60 });
		expect([...recordsRead]).toEqual([60]);
	});

	test('that loads nothing reads no record for a path no module has reported', () => {
		recordsRead.clear();

		expect(metro.find(byFilePath('modules/m70.tsx'), { initialize: false })).toBeNull();
		expect([...recordsRead]).toEqual([]);
		expect(isLoaded(70)).toBe(false);
	});

	test('still loads the module from that file when the search may load', () => {
		expect(metro.findByFilePath('modules/m80.tsx', { interop: false })).toEqual({ id: 80 });
		expect(isLoaded(80)).toBe(true);
	});
});
