import { describe, expect, test, beforeEach } from 'bun:test';

import { installMetroGlobals } from '../helpers/metro-fixture';

// Sentinel matching the engine's own probe: a key no real module owns. A catch-all proxy answers its
// `has` trap truthy for arbitrary keys without owning them, which is exactly what `isCatchAllProxy`
// detects. We hand-build one here to test the *mechanism*, carrying no Discord proxy names.
const catchAll = new Proxy(
	{},
	{
		has: () => true,
		get: () => undefined,
		getOwnPropertyDescriptor: () => undefined,
	},
);

installMetroGlobals({
	modules: {
		// A real object that legitimately matches a props filter.
		1: { exports: { marker: 1 } },
		// A catch-all proxy: `in` is truthy for any key, so it would false-match a props filter.
		2: { factory: (_g, _r, _d, _a, moduleObject) => void (moduleObject.exports = catchAll) },
		// Exports that are the global object.
		3: { factory: (_g, _r, _d, _a, moduleObject) => void (moduleObject.exports = globalThis) },
	},
});

const Metro = await import('~/api/metro');
const { data, blacklist } = await import('~/api/metro/state');
const Cache = (await import('~/lib/cache')).default;
const { byProps } = await import('~/api/metro/filters');

beforeEach(() => {
	Cache.state.modules = {};
	data.cache.clear();
	blacklist.clear();
});

describe('isInvalidExport mechanism', () => {
	test('a real object is kept and not blacklisted', () => {
		const found = Metro.find(byProps('marker'), { cache: false });

		expect(found).toEqual({ marker: 1 });
		expect(blacklist.has(1)).toBe(false);
	});

	test('a catch-all proxy is rejected and blacklisted despite a truthy `in`', () => {
		// `'anything' in catchAll` is truthy, so without the guard this props filter would match it.
		expect('anything' in catchAll).toBe(true);

		Metro.find(byProps('anything'), { cache: false });

		expect(blacklist.has(2)).toBe(true);
	});

	test('a catch-all proxy never wins a search it would otherwise false-match', () => {
		const found = Metro.find(byProps('somethingUnique'), { cache: false });

		expect(found).toBeNull();
	});

	test('exports that are the global object are rejected and blacklisted', () => {
		// globalThis carries loads of props; without the guard `byProps` on a global key would match.
		Metro.find(byProps('Object'), { cache: false });

		expect(blacklist.has(3)).toBe(true);
	});
});
