import { beforeEach, describe, expect, mock, test } from 'bun:test';

import { startFakeMetro } from './helpers/fake-metro';
import { createCacheMock } from './helpers/cache';

const SETTINGS = 30;
const cachedIds: Record<string, number[]> = {};

Object.assign(globalThis, {
	$$DEV$$: false,
	window: globalThis,
	ErrorUtils: { getGlobalHandler: () => undefined, setGlobalHandler: () => undefined },
});

const fakeMetro = startFakeMetro();

for (let id = 10; id < 50; id++) {
	fakeMetro.define(id, [], (_, __, ___, ____, module) => {
		module.exports = id === SETTINGS ? { route: 'SETTINGS', colors: {} } : { id };
	});
	fakeMetro.require(id);
}

const modules = globalThis.modules;
const recordsRead = new Set<number>();
const readRecord = modules.get.bind(modules);

modules.get = (id: number) => {
	recordsRead.add(id);

	return readRecord(id);
};

mock.module('~/metro/cache', () =>
	createCacheMock({
		getModuleIds: () => [...modules.keys()],
		getModuleCacheForKey: (key: string) => cachedIds[key],
		addCachedIDForKey(key: string, id: number) {
			cachedIds[key] ??= [];
			cachedIds[key].push(id);
		},
		markKeyMissing(key: string) {
			cachedIds[key] = [];
		},
	}),
);

const { find } = await import('~/metro/search');
const { data } = await import('~/metro/state');
const { filter } = await import('~/metro/custom-filter');
const { all, any, not, byName, byProps } = await import('~/metro/filters');
const { CACHE_KEY } = await import('~/core/constants');

// The key the build injects into a predicate it can trace.
function keyed<T extends object>(predicate: T, key: string): T {
	return Object.assign(predicate, { [CACHE_KEY]: key });
}

beforeEach(() => {
	for (const key of Object.keys(cachedIds)) delete cachedIds[key];

	data.cache.clear();
	recordsRead.clear();
});

describe('a custom filter', () => {
	test('records its match under its key, and a later search reads only that module, as byProps does', () => {
		const byRoute = filter(
			keyed((mdl, route: string) => mdl.route === route, 'custom::0123456789abcdef'),
		);

		expect(find(byRoute('SETTINGS'), { interop: false })).toEqual({
			route: 'SETTINGS',
			colors: {},
		});
		expect(cachedIds).toEqual({ 'custom::0123456789abcdef::["SETTINGS"]': [SETTINGS] });

		data.cache.clear();
		recordsRead.clear();
		find(byRoute('SETTINGS'));
		expect([...recordsRead]).toEqual([SETTINGS]);

		find(byProps('route'));
		data.cache.clear();
		recordsRead.clear();
		find(byProps('route'));
		expect([...recordsRead]).toEqual([SETTINGS]);
	});

	test('keys each set of arguments apart', () => {
		const byRoute = filter(
			keyed((mdl, route: string) => mdl.route === route, 'custom::0123456789abcdef'),
		);

		expect(find(byRoute('MISSING'))).toBeNull();
		expect(cachedIds['custom::0123456789abcdef::["MISSING"]']).toEqual([]);
	});

	test('stays unkeyed for an argument JSON cannot spell', () => {
		const byValue = filter(
			keyed((mdl, value: never) => mdl.route === value, 'custom::0123456789abcdef'),
		);

		expect(byValue(void 0 as never)[CACHE_KEY]).toBeUndefined();
	});

	test('without a build key still searches, uncached', () => {
		const unkeyed = (mdl: MetroExport) => mdl.route === 'SETTINGS';

		expect(find(unkeyed)).toEqual({ route: 'SETTINGS', colors: {} });
		expect(cachedIds).toEqual({});
	});
});

describe('filter combinators', () => {
	test('match like the logic they name', () => {
		expect(find(all(byProps('route'), byProps('colors')))).toEqual({
			route: 'SETTINGS',
			colors: {},
		});
		expect(find(any(byName('nothing'), byProps('route')))).toEqual({
			route: 'SETTINGS',
			colors: {},
		});
		expect(not(byProps('route'))({ id: 1 }, 1)).toBe(true);
	});

	test('key their parts in any order, flattening a nested combinator of the same kind', () => {
		const flat = all(byProps('a'), byName('B'), byProps('c'));

		expect(all(byName('B'), all(byProps('c'), byProps('a')))[CACHE_KEY]).toBe(flat[CACHE_KEY]);
		expect(flat[CACHE_KEY]).toBe('all("byName::B","byProps::a","byProps::c")');
		expect(any(byProps('a'), any(byName('B')))[CACHE_KEY]).toBe(
			'any("byName::B","byProps::a")',
		);
		expect(all(byProps('a'), any(byName('B'), byProps('c')))[CACHE_KEY]).toBe(
			'all("any(\\"byName::B\\",\\"byProps::c\\")","byProps::a")',
		);
		expect(not(byProps('a'))[CACHE_KEY]).toBe('not("byProps::a")');
	});

	test('stay unkeyed when any part is', () => {
		const unkeyed = (mdl: MetroExport) => Boolean(mdl.route);

		expect(all(byProps('a'), unkeyed)[CACHE_KEY]).toBeUndefined();
		expect(all(byProps('a'), all(byProps('b'), unkeyed))[CACHE_KEY]).toBeUndefined();
		expect(not(unkeyed)[CACHE_KEY]).toBeUndefined();

		find(any(byName('nothing'), unkeyed));
		expect(cachedIds).toEqual({});
	});
});
