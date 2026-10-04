import { describe, expect, test } from 'bun:test';

import { installBuildTokens } from '../helpers/metro-fixture';

// filters.ts is pure - no metro substrate - but it imports `~/lib/constants` for `CACHE_KEY`, which
// references the build-time `$$DEV$$` token. Define it before the dynamic import so constants evals.
installBuildTokens();

const Filters = await import('~/api/metro/filters');
const { CACHE_KEY } = await import('~/lib/constants');

describe('byProps', () => {
	test('single prop takes the fast path: present matches, absent rejects', () => {
		const filter = Filters.byProps('foo');

		expect(filter({ foo: 1 }, 0)).toBe(true);
		expect(filter({ bar: 1 }, 0)).toBe(false);
		expect(filter({ foo: undefined }, 0)).toBe(false);
	});

	test('multiple props require every one to be present', () => {
		const filter = Filters.byProps('foo', 'bar');

		expect(filter({ foo: 1, bar: 2 }, 0)).toBe(true);
		expect(filter({ foo: 1 }, 0)).toBe(false);
		expect(filter({ bar: 2 }, 0)).toBe(false);
	});

	test('cache key is the sorted prop names joined by `::`', () => {
		expect(Filters.byProps('b', 'a')[CACHE_KEY]).toBe('byProps::a::b');
		expect(Filters.byProps('a', 'b')[CACHE_KEY]).toBe('byProps::a::b');
	});
});

describe('byName', () => {
	test('matches on `name` equality', () => {
		const filter = Filters.byName('Thing');

		expect(filter({ name: 'Thing' }, 0)).toBe(true);
		expect(filter({ name: 'Other' }, 0)).toBe(false);
	});

	test('cache key names the value', () => {
		expect(Filters.byName('Thing')[CACHE_KEY]).toBe('byName::Thing');
	});
});

describe('byDisplayName', () => {
	test('matches on `displayName` equality', () => {
		const filter = Filters.byDisplayName('Thing');

		expect(filter({ displayName: 'Thing' }, 0)).toBe(true);
		expect(filter({ displayName: 'Other' }, 0)).toBe(false);
	});

	test('cache key names the value', () => {
		expect(Filters.byDisplayName('Thing')[CACHE_KEY]).toBe('byDisplayName::Thing');
	});
});

describe('byPrototypes', () => {
	test('rejects a module with no prototype', () => {
		const filter = Filters.byPrototypes('render');

		expect(filter({}, 0)).toBe(false);
	});

	test('matches when the prototype exposes every method', () => {
		const filter = Filters.byPrototypes('render', 'update');

		expect(filter({ prototype: { render() {}, update() {} } }, 0)).toBe(true);
		expect(filter({ prototype: { render() {} } }, 0)).toBe(false);
	});

	test('cache key is the sorted method names joined by `::`', () => {
		expect(Filters.byPrototypes('b', 'a')[CACHE_KEY]).toBe('byPrototypes::a::b');
	});
});

describe('byFilePath', () => {
	test('matches on tracked `__filePath` equality and is marked raw', () => {
		const path = ['a', 'b'];
		const filter = Filters.byFilePath(path);

		expect(filter({ __filePath: path }, 0)).toBe(true);
		expect(filter({ __filePath: ['c'] }, 0)).toBe(false);
		expect(filter.isRaw).toBe(true);
		expect(filter[CACHE_KEY]).toBe(`byFilePath::${path}`);
	});
});

describe('byStore', () => {
	// Only the cache-key string is asserted here - that is our engine's own logic. The predicate's
	// match body reads a flux store's `_dispatcher`/`getName()` shape, which is a Discord bundle fact
	// that drifts between builds; asserting against it is cut by design.
	test('short (default) appends `Store` to the cache key', () => {
		expect(Filters.byStore('User')[CACHE_KEY]).toBe('byStore::UserStore');
	});

	test('short=false leaves the raw name in the cache key', () => {
		expect(Filters.byStore('User', false)[CACHE_KEY]).toBe('byStore::User');
	});
});
