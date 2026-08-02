import { describe, expect, test, spyOn, beforeEach } from 'bun:test';

import { installMetroGlobals } from '../helpers/metro-fixture';

// Fixed registry: three factory-backed, plain-object modules. Every test below varies a `find` option
// over this same input so each assertion exercises a distinct branch of the engine — not a
// planted-module tautology.
installMetroGlobals({
	modules: {
		1: { exports: { alpha: 1 } },
		2: { exports: { beta: 2 } },
		3: { exports: { alpha: 1, gamma: 3 } },
	},
});

const Metro = await import('~/api/metro');
const { data, blacklist } = await import('~/api/metro/state');
const Cache = (await import('~/lib/cache')).default;
const { byProps } = await import('~/api/metro/filters');

// The per-key cache (`state.modules`), the resolved-module cache (`data.cache`), and the blacklist are
// module-level singletons that persist across finds by design. Reset them per test so each starts from
// a cold cache and the branch under test is the one exercised, not a hit left by a neighbour.
beforeEach(() => {
	Cache.state.modules = {};
	data.cache.clear();
	blacklist.clear();
});

describe('find', () => {
	test('returns the first match by default', () => {
		const found = Metro.find(byProps('alpha'));

		expect(found).toEqual({ alpha: 1 });
	});

	test('all: true collects every match into an array', () => {
		const found = Metro.find(byProps('alpha'), { all: true });

		expect(Array.isArray(found)).toBe(true);
		expect(found).toHaveLength(2);
	});

	test('a non-matching filter returns null for a single find', () => {
		const found = Metro.find(byProps('nonexistent'));

		expect(found).toBeNull();
	});

	test('initial seeds the accumulator for an all-search', () => {
		const seed = { seeded: true };
		const found = Metro.find(byProps('beta'), { all: true, initial: [seed] });

		expect(found).toContain(seed);
		expect(found).toHaveLength(2);
	});

	test('a warmed per-key cache serves later finds from the fast path', () => {
		// First find populates `state.modules[cacheKey]` with the matching id.
		Metro.find(byProps('gamma'));
		expect(Cache.getModuleCacheForKey('byProps::gamma')).toEqual([3]);

		// Second find with the same key takes the cache branch: it walks only the cached id, so if we
		// blank the resolved-module cache but leave the per-key cache, it still resolves from the
		// registry via that id.
		data.cache.clear();
		const found = Metro.find(byProps('gamma'));

		expect(found).toEqual({ alpha: 1, gamma: 3 });
	});

	test('MUTATION PROBE: a cache-miss find mutates the caller-owned options object', () => {
		// On a cache miss, find()'s fallback recurses with `Object.assign(options, { cache: false })`,
		// writing through the caller's object rather than a copy. Documented so a refactor to a
		// non-mutating spread is a deliberate, visible change, not a silent regression.
		const options: { cache: boolean } = { cache: true };
		Metro.find(byProps('alpha'), options);

		expect(options.cache).toBe(false);
	});

	test('a throwing filter degrades: returns no match and logs exactly once', () => {
		const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

		try {
			let calls = 0;
			const thrower = (() => {
				calls++;
				throw new Error('boom');
			}) as any;

			const found = Metro.find(thrower);

			expect(found).toBeNull();
			// The `errored` latch short-circuits every filter call after the first throw within the
			// registry scan, so the walk keeps running to completion but only one error is logged.
			expect(calls).toBeGreaterThanOrEqual(1);
			expect(errorSpy).toHaveBeenCalledTimes(1);
		} finally {
			errorSpy.mockRestore();
		}
	});
});
