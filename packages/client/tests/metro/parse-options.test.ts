import { describe, expect, test, beforeEach } from 'bun:test';

import { installMetroGlobals } from '../helpers/metro-fixture';

// `findBy*` is the only public entry into `parseOptions`; each test reads back whether the trailing
// argument was split off as options or kept as a search term.
function named() {}

installMetroGlobals({
	modules: {
		1: { exports: { alpha: 1 } },
		2: { exports: { alpha: 1, extra: true } },
		3: { exports: named },
	},
});

const Metro = await import('~/api/metro');
const { data, blacklist } = await import('~/api/metro/state');
const Cache = (await import('~/lib/cache')).default;

beforeEach(() => {
	Cache.state.modules = {};
	data.cache.clear();
	blacklist.clear();
});

describe('parseOptions via findBy*', () => {
	test('a trailing plain object is detected as options, not a search term', () => {
		const found = Metro.findByProps('alpha', { all: true });

		expect(Array.isArray(found)).toBe(true);
		expect(found).toHaveLength(2);
	});

	test('with no trailing object, every argument is a search term', () => {
		const found = Metro.findByProps('alpha', 'extra');

		expect(found).toEqual({ alpha: 1, extra: true });
	});

	test('findByName splits its trailing options object off the name terms', () => {
		const found = Metro.findByName('named', { cache: true });

		expect(found).toBe(named);
	});
});
