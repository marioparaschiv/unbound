import { describe, expect, test, spyOn, beforeEach } from 'bun:test';

import type { MetroFilter } from '~/api/metro/filters';

import { installMetroGlobals } from '../helpers/metro-fixture';

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

// Reset the module-level cache/blacklist singletons so each test starts from a cold cache.
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
		Metro.find(byProps('gamma'));
		expect(Cache.getModuleCacheForKey('byProps::gamma')).toEqual([3]);

		// Clearing only the resolved-module cache forces the second find down the per-key cache branch.
		data.cache.clear();
		const found = Metro.find(byProps('gamma'));

		expect(found).toEqual({ alpha: 1, gamma: 3 });
	});

	test('MUTATION PROBE: a cache-miss find mutates the caller-owned options object', () => {
		// find()'s cache-miss fallback recurses with `Object.assign(options, { cache: false })`, writing
		// through the caller's object. A non-mutating refactor should flip this deliberately.
		const options: { cache: boolean } = { cache: true };
		Metro.find(byProps('alpha'), options);

		expect(options.cache).toBe(false);
	});

	test('a throwing filter degrades: returns no match and logs exactly once', () => {
		const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

		try {
			let calls = 0;
			const thrower: MetroFilter = () => {
				calls++;
				throw new Error('boom');
			};

			const found = Metro.find(thrower);

			expect(found).toBeNull();
			expect(calls).toBeGreaterThanOrEqual(1);
			expect(errorSpy).toHaveBeenCalledTimes(1);
		} finally {
			errorSpy.mockRestore();
		}
	});
});
