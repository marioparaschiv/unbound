import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import type { MetroFilter } from '~/metro/filters';

type Exports = Record<string, (...args: number[]) => number | null>;
type Factory = (
	global: typeof globalThis,
	require: (id: number) => Exports,
	importDefault: (id: number) => Exports,
	importAll: (id: number) => Exports,
	module: MetroPublicModule,
) => void;

const cachedIds: Record<string, number[]> = {};

Object.assign(globalThis, { $$DEV$$: false, window: globalThis });

// A fake Metro registry: modules 0 and 1 are loaded before Unbound, the rest load on demand.
const modules = new Map<number, MetroModuleRecord>();

function define(id: number, factory: Factory) {
	modules.set(id, { factory, isInitialized: false, publicModule: { id, exports: {} } });
}

function metroRequire(id: number): Exports {
	const record = modules.get(id);

	if (!record) {
		throw new Error(`No module ${id}`);
	}

	if (!record.isInitialized) {
		record.isInitialized = true;
		record.factory?.(globalThis, metroRequire, metroRequire, metroRequire, record.publicModule);
		record.factory = undefined;
	}

	return record.publicModule.exports;
}

function exporting(id: number, exported: Exports) {
	define(id, (_, __, ___, ____, module) => void (module.exports = exported));
}

// The renderer, with no React surface mounted under bun.
exporting(0, { getPublicInstanceFromRootTag: () => null });
exporting(1, { double: (n) => n * 2 });
exporting(2, { triple: (n) => n * 3 });
exporting(3, { square: (n) => n * n });
define(4, (_, require, ___, ____, module) => {
	// Captures `square` by value, as Discord's modules often do with their imports.
	const { square } = require(3);

	module.exports = { squareCaptured: square };
});
exporting(5, { half: (n) => n / 2 });
exporting(6, { decoy: () => 0 });
exporting(7, { moved: () => 7 });
exporting(8, { shared: () => 8, other: () => 8 });
exporting(9, { odd: () => 9 });
exporting(10, { wanted: () => 10 });
exporting(11, { negate: (n) => -n });
exporting(12, { awaited: () => 12 });
exporting(13, { abandoned: () => 13 });
exporting(14, { quadruple: (n) => n * 4 });
exporting(15, { fifth: (n) => n / 5 });
exporting(16, { picked: () => 16 });
exporting(17, { picked: () => 17 });
exporting(18, { remembered: () => 18 });
exporting(19, { remembered: () => 19 });
exporting(20, { forced: () => 20 });
exporting(21, { late: () => 21 });
exporting(22, { viaFind: () => 22 });
exporting(23, { presentLoaded: () => 23 });
exporting(24, { presentCached: () => 24 });
exporting(25, { presentUnseen: () => 25 });
metroRequire(0);
metroRequire(1);

Object.assign(globalThis, {
	modules,
	__r: metroRequire,
	ErrorUtils: { getGlobalHandler: () => undefined, setGlobalHandler: () => undefined },
});

mock.module('~/metro/cache', () => ({
	ModuleFlags: { BLACKLISTED: 1 },
	default: {
		moduleIds: [...modules.keys()],
		hasModuleFlag: () => false,
		addModuleFlag: () => undefined,
		getModuleCacheForKey: (key: string) => cachedIds[key],
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
const { findByPropsLazy } = await import('~/metro/wrappers');
const { getModulePresence } = await import('~/metro/lazy-registry');
const { onModuleLoaded } = await import('~/metro/wait');
const { byProps } = await import('~/metro/filters');
const { CACHE_KEY } = await import('~/core/constants');
const { after, createPatcher, unpatchAll, unpatchAllByCaller } = await import('~/patcher/api');

beforeEach(() => {
	for (const key of Object.keys(cachedIds)) delete cachedIds[key];
});

afterEach(() => unpatchAll());

function isLoaded(id: number) {
	return Boolean(modules.get(id)?.isInitialized);
}

function loadedIds() {
	return [...modules.keys()].filter(isLoaded);
}

describe('onModuleLoaded', () => {
	test('a wait cancelled by another wait on the same module never runs', () => {
		cachedIds['byProps::shared'] = [8];
		cachedIds['byProps::other'] = [8];

		const calls: string[] = [];
		let stopOther = () => {};

		onModuleLoaded(byProps('shared'), () => {
			calls.push('shared');
			stopOther();
		});
		stopOther = onModuleLoaded(byProps('other'), () => calls.push('other'));
		metroRequire(8);

		expect(calls).toEqual(['shared']);
	});

	test('keeps waiting after its filter throws on one module', () => {
		const found: Exports[] = [];

		onModuleLoaded(
			(mdl) => {
				if (mdl.odd) {
					throw new Error('odd module');
				}

				return Boolean(mdl.wanted);
			},
			(mdl) => found.push(mdl),
		);
		metroRequire(9);
		metroRequire(10);

		expect(found.map((mdl) => mdl.wanted())).toEqual([10]);
	});

	test('passes a loaded module at once', () => {
		const found: Exports[] = [];

		onModuleLoaded(byProps('double'), (mdl) => found.push(mdl));

		expect(found.map((mdl) => mdl.double(2))).toEqual([4]);
	});

	test('waits for a module without loading it, and runs before its importer reads it', () => {
		const seen: string[] = [];

		onModuleLoaded(byProps('square'), (mdl) => {
			seen.push('square loaded');
			mdl.square = (n: number) => -n;
		});

		expect(isLoaded(3)).toBe(false);
		expect(seen).toEqual([]);

		expect(metroRequire(4).squareCaptured(5)).toBe(-5);
		expect(seen).toEqual(['square loaded']);
	});

	test('falls back to testing every module when the cached id no longer matches', () => {
		cachedIds['byProps::moved'] = [6];

		const found: Exports[] = [];

		onModuleLoaded(byProps('moved'), (mdl) => found.push(mdl));
		metroRequire(6);

		expect(found).toEqual([]);

		metroRequire(7);

		expect(found.map((mdl) => mdl.moved())).toEqual([7]);
		expect(cachedIds['byProps::moved']).toEqual([6, 7]);
	});
});

describe('findLazy', () => {
	test('resolves once Discord loads the module, without loading it', async () => {
		const found = metro.findLazy(byProps('awaited'));

		expect(isLoaded(12)).toBe(false);

		metroRequire(12);

		expect(((await found) as Exports).awaited()).toBe(12);
	});

	test('resolves with undefined when its signal aborts first', async () => {
		const controller = new AbortController();
		const found = metro.findLazy(byProps('abandoned'), { signal: controller.signal });

		controller.abort();
		metroRequire(13);

		expect(await found).toBeUndefined();
	});
});

describe('patching a lazy module', () => {
	test('patches a loaded module at once', () => {
		const Doubler = metro.findByProps('double', { lazy: true });

		after(Doubler, 'double', ({ result }) => result + 1);

		expect(metroRequire(1).double(2)).toBe(5);
	});

	test('does not load the module, and patches it before Discord captures the method', () => {
		const Tripler = metro.findByProps('triple', { lazy: true });

		createPatcher('lazy.triple').after(Tripler, 'triple', ({ result }) => result + 1);

		expect(isLoaded(2)).toBe(false);
		expect(metroRequire(2).triple(2)).toBe(7);
		expect(Tripler.triple(2)).toBe(7);
	});

	test('find with lazy returns a handle whose patch waits for the module', () => {
		const ViaFind = metro.find(byProps('viaFind'), { lazy: true });

		after(ViaFind, 'viaFind', ({ result }) => result + 1);

		expect(isLoaded(22)).toBe(false);
		expect(metroRequire(22).viaFind()).toBe(23);
	});

	test('the returned unpatch cancels a patch that is still waiting', () => {
		const Negator = metro.findByProps('negate', { lazy: true });

		after(Negator, 'negate', () => 0)();

		expect(metroRequire(11).negate(3)).toBe(-3);
	});

	test('a stopped addon never patches a module that loads after it stopped', () => {
		const Halver = metro.findByProps('half', { lazy: true });

		createPatcher('lazy.half').after(Halver, 'half', () => 0);
		unpatchAllByCaller('lazy.half');

		expect(isLoaded(5)).toBe(false);
		expect(metroRequire(5).half(8)).toBe(4);
	});
});

describe('a lazy wrapper handle (findByPropsLazy and the like)', () => {
	test('a patch on it waits for the module instead of loading it', () => {
		const Quadrupler = findByPropsLazy('quadruple');

		createPatcher('lazy.quadruple').after(Quadrupler, 'quadruple', ({ result }) => result + 1);

		expect(isLoaded(14)).toBe(false);
		expect(metroRequire(14).quadruple(2)).toBe(9);
		expect(Quadrupler.quadruple(2)).toBe(9);
	});

	test('reading it loads the module and behaves as the module for every operation', () => {
		cachedIds['byProps::fifth'] = [15];

		const Fifth = findByPropsLazy('fifth');

		expect(Fifth.fifth(10)).toBe(2);
		expect(isLoaded(15)).toBe(true);
		expect(Object.keys(Fifth)).toEqual(['fifth']);
		expect('fifth' in Fifth).toBe(true);
		expect({ ...Fifth }.fifth).toBe(metroRequire(15).fifth);
		expect(Object.getPrototypeOf(Fifth)).toBe(Object.prototype);
	});
});

describe('getModulePresence', () => {
	test('reports a lazy handle as loaded, present, missing or unknown without loading anything', () => {
		metroRequire(23);
		cachedIds['byProps::presentCached'] = [24];
		cachedIds['byProps::presentGone'] = [];

		const before = loadedIds();
		const presence = {
			loaded: getModulePresence(metro.findByProps('presentLoaded', { lazy: true })),
			present: getModulePresence(metro.findByProps('presentCached', { lazy: true })),
			missing: getModulePresence(metro.findByProps('presentGone', { lazy: true })),
			unknown: getModulePresence(findByPropsLazy('presentUnseen')),
		};

		expect(presence).toEqual({
			loaded: 'loaded',
			present: 'present',
			missing: 'missing',
			unknown: 'unknown',
		});
		expect(loadedIds()).toEqual(before);
	});

	test('reports a cached module as loaded once Discord loads it', () => {
		cachedIds['byProps::presentCached'] = [24];

		const Cached = metro.findByProps('presentCached', { lazy: true });

		metroRequire(24);

		expect(getModulePresence(Cached)).toBe('loaded');
	});

	test('has nothing to report for a value that is not a lazy handle', () => {
		expect(getModulePresence({ presentLoaded: () => 23 })).toBeUndefined();
	});
});

describe('find', () => {
	test('returns an initialized module without loading an earlier match', () => {
		metroRequire(17);

		const before = loadedIds();

		expect(metro.findByProps('picked').picked()).toBe(17);
		expect(loadedIds()).toEqual(before);
	});

	test('prefers an initialized module over an uninitialized cached id', () => {
		cachedIds['byProps::remembered'] = [18];
		metroRequire(19);

		expect(metro.findByProps('remembered').remembered()).toBe(19);
		expect(isLoaded(18)).toBe(false);
	});

	test('loads only the cached module when no initialized module matches', () => {
		cachedIds['byProps::forced'] = [20];

		const before = loadedIds();

		expect(metro.findByProps('forced').forced()).toBe(20);
		expect(loadedIds()).toEqual([...before, 20].sort((a, b) => a - b));
	});

	test('a wait on a remembered miss still matches any module that loads', () => {
		cachedIds['byProps::late'] = [];

		const found: Exports[] = [];

		onModuleLoaded(byProps('late'), (mdl) => found.push(mdl));
		metroRequire(21);

		expect(found.map((mdl) => mdl.late())).toEqual([21]);
	});

	// Runs last: a miss loads the whole registry.
	test('remembers a miss after a full scan, and scans nothing for it again', () => {
		let tested = 0;
		const filter: MetroFilter = (mdl) => {
			tested++;

			return mdl.nowhere !== void 0;
		};

		filter[CACHE_KEY] = 'test::nowhere';

		expect(metro.find(filter)).toBeNull();
		expect(tested).toBeGreaterThan(0);
		expect(cachedIds['test::nowhere']).toEqual([]);

		tested = 0;

		expect(metro.find(filter)).toBeNull();
		expect(tested).toBe(0);
	});
});
