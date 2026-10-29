import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import type { MetroFilter } from '~/api/metro/filters';

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

// The renderer, with no React surface mounted under bun.
define(0, (_, __, ___, ____, module) => {
	module.exports = { getPublicInstanceFromRootTag: () => null };
});
define(1, (_, __, ___, ____, module) => {
	module.exports = { double: (n) => n * 2 };
});
define(2, (_, __, ___, ____, module) => {
	module.exports = { triple: (n) => n * 3 };
});
define(3, (_, __, ___, ____, module) => {
	module.exports = { square: (n) => n * n };
});
define(4, (_, require, ___, ____, module) => {
	// Captures `square` by value, as Discord's modules often do with their imports.
	const { square } = require(3);

	module.exports = { squareCaptured: square };
});
define(5, (_, __, ___, ____, module) => {
	module.exports = { half: (n) => n / 2 };
});
define(6, (_, __, ___, ____, module) => {
	module.exports = { decoy: () => 0 };
});
define(7, (_, __, ___, ____, module) => {
	module.exports = { moved: () => 7 };
});
define(8, (_, __, ___, ____, module) => {
	module.exports = { shared: () => 8, other: () => 8 };
});
define(9, (_, __, ___, ____, module) => {
	module.exports = { odd: () => 9 };
});
define(10, (_, __, ___, ____, module) => {
	module.exports = { wanted: () => 10 };
});
define(11, (_, __, ___, ____, module) => {
	module.exports = { negate: (n) => -n };
});
define(12, (_, __, ___, ____, module) => {
	module.exports = { awaited: () => 12 };
});
define(13, (_, __, ___, ____, module) => {
	module.exports = { abandoned: () => 13 };
});
define(14, (_, __, ___, ____, module) => {
	module.exports = { quadruple: (n) => n * 4 };
});
define(15, (_, __, ___, ____, module) => {
	module.exports = { fifth: (n) => n / 5 };
});
define(16, (_, __, ___, ____, module) => {
	module.exports = { picked: () => 16 };
});
define(17, (_, __, ___, ____, module) => {
	module.exports = { picked: () => 17 };
});
define(18, (_, __, ___, ____, module) => {
	module.exports = { remembered: () => 18 };
});
define(19, (_, __, ___, ____, module) => {
	module.exports = { remembered: () => 19 };
});
define(20, (_, __, ___, ____, module) => {
	module.exports = { forced: () => 20 };
});
define(21, (_, __, ___, ____, module) => {
	module.exports = { late: () => 21 };
});
metroRequire(0);
metroRequire(1);

Object.assign(globalThis, {
	modules,
	__r: metroRequire,
	ErrorUtils: { getGlobalHandler: () => undefined, setGlobalHandler: () => undefined },
});

mock.module('~/lib/cache', () => ({
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

const metro = await import('~/api/metro/search');
// Other test files mock `~/api/metro/wrappers`, so the handles come from the function behind it.
const { findLazy } = await import('~/api/metro/finders');
const { onModuleLoaded, waitForModule } = await import('~/api/metro/wait');
const { byProps } = await import('~/api/metro/filters');
const { CACHE_KEY } = await import('~/lib/constants');
const { after, createPatcher, unpatchAll, unpatchAllByCaller } = await import('~/api/patcher');

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

describe('waitForModule', () => {
	test('resolves once Discord loads the module, without loading it', async () => {
		const found = waitForModule(byProps('awaited'));

		expect(isLoaded(12)).toBe(false);

		metroRequire(12);

		expect(((await found) as Exports).awaited()).toBe(12);
	});

	test('resolves with undefined when its signal aborts first', async () => {
		const controller = new AbortController();
		const found = waitForModule(byProps('abandoned'), { signal: controller.signal });

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
		const Quadrupler = findLazy('findByProps', ['quadruple']);

		createPatcher('lazy.quadruple').after(Quadrupler, 'quadruple', ({ result }) => result + 1);

		expect(isLoaded(14)).toBe(false);
		expect(metroRequire(14).quadruple(2)).toBe(9);
		expect(Quadrupler.quadruple(2)).toBe(9);
	});

	test('reading it loads the module and behaves as the module for every operation', () => {
		cachedIds['byProps::fifth'] = [15];

		const Fifth = findLazy('findByProps', ['fifth']);

		expect(Fifth.fifth(10)).toBe(2);
		expect(isLoaded(15)).toBe(true);
		expect(Object.keys(Fifth)).toEqual(['fifth']);
		expect('fifth' in Fifth).toBe(true);
		expect({ ...Fifth }.fifth).toBe(metroRequire(15).fifth);
		expect(Object.getPrototypeOf(Fifth)).toBe(Object.prototype);
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
