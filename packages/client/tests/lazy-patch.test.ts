import { afterEach, describe, expect, mock, test } from 'bun:test';

const LOADED_ID = 1;
const loadedExports = { loaded: (value: number) => value };
const records = new Map<number, MetroModuleRecord>([
	[LOADED_ID, { isInitialized: true, publicModule: { id: LOADED_ID, exports: loadedExports } }],
]);
const methods = ['first', 'second', 'third', 'fourth', 'fifth'];

for (const [index, method] of methods.entries()) {
	const id = index + 2;
	const exported = { [method]: (value: number) => value };

	records.set(id, {
		isInitialized: false,
		publicModule: { id, exports: {} },
		factory: (...args: Parameters<MetroDefine>) => void (args[4].exports = exported),
	});
}

let searchLoads = 0;

function load(id: number) {
	const record = records.get(id);

	if (!record || record.isInitialized) {
		return record?.publicModule.exports;
	}

	record.factory?.(globalThis, __r, null, null, record.publicModule);
	record.isInitialized = true;

	return record.publicModule.exports;
}

Object.assign(globalThis, {
	window: globalThis,
	modules: records,
	$$DEV$$: false,
	ErrorUtils: { getGlobalHandler: () => void 0, setGlobalHandler: () => void 0 },
	__r: (id: number) => {
		searchLoads++;

		return load(id);
	},
});

mock.module('~/metro/cache', () => ({
	default: {
		moduleIds: [...records.keys()],
		hasModuleFlag: () => false,
		addModuleFlag: () => void 0,
		getModuleCacheForKey: () => void 0,
		addCachedIDForKey: () => void 0,
	},
	ModuleFlags: { BLACKLISTED: 1 },
}));

// No React surface is mounted under bun, so the renderer finds no roots.
mock.module('~/metro/wrappers', () => ({
	findByPropsLazy: () => ({ getPublicInstanceFromRootTag: () => null }),
}));

const { after, createPatcher, unpatchAll, unpatchAllByCaller } = await import('~/patcher/api');
const { findByProps } = await import('~/metro/lookups');
const { data } = await import('~/metro/state');

function idOf(method: string) {
	return methods.indexOf(method) + 2;
}

function exportsOf(method: string) {
	return records.get(idOf(method))?.publicModule.exports;
}

afterEach(() => {
	unpatchAll();
	searchLoads = 0;
});

describe('lazy patch targets', () => {
	test('a patch on a lazy target applies when its module loads, with no search before', () => {
		const target = findByProps('first');

		after(target, 'first', (ctx) => ctx.result * 10);

		expect(searchLoads).toBe(0);
		expect(records.get(idOf('first'))?.isInitialized).toBe(false);

		load(idOf('first'));

		expect(exportsOf('first').first(2)).toBe(20);
		expect(searchLoads).toBe(0);
	});

	test('unpatching before the module loads leaves nothing behind', () => {
		const listeners = data.listeners.size;
		const original = records.get(idOf('second'))?.factory;
		const unpatch = after(findByProps('second'), 'second', () => 0);
		const patcher = createPatcher('plugin');

		patcher.after(findByProps('second'), 'second', () => 1);
		createPatcher('stopped-plugin').after(findByProps('second'), 'second', () => 2);

		expect(data.listeners.size).toBe(listeners + 3);

		unpatch();
		patcher.unpatchAll();
		unpatchAllByCaller('stopped-plugin');

		expect(data.listeners.size).toBe(listeners);

		load(idOf('second'));

		expect(exportsOf('second').second(5)).toBe(5);
		expect(records.get(idOf('second'))?.factory).toBe(original);
		expect(searchLoads).toBe(0);
	});

	test('a patch on a lazy target whose module already loaded applies at once', () => {
		after(findByProps('loaded'), 'loaded', (ctx) => ctx.result + 1);

		expect(loadedExports.loaded(1)).toBe(2);
		expect(searchLoads).toBe(0);
	});

	test('unpatchAll drops a patch still waiting for its module', () => {
		after(findByProps('third'), 'third', () => 0);
		unpatchAll();
		load(idOf('third'));

		expect(exportsOf('third').third(3)).toBe(3);
	});
});

describe('addon-facing lookups', () => {
	test('are lazy by default', () => {
		const lookup = findByProps('fourth');

		expect(searchLoads).toBe(0);
		expect(lookup.fourth(4)).toBe(4);
		expect(searchLoads).toBe(1);
	});

	test('search at once with { lazy: false }', () => {
		const lookup = findByProps('fifth', { lazy: false });

		expect(searchLoads).toBe(1);
		expect(lookup).toBe(exportsOf('fifth'));
	});

	test('search at once for every match with { all: true }', () => {
		const matches = findByProps('loaded', { all: true });

		expect(Array.isArray(matches)).toBe(true);
		expect(matches).toContain(loadedExports);
	});
});
