import { describe, expect, test, beforeEach } from 'bun:test';

import { installMetroGlobals } from '../helpers/metro-fixture';

// Two modules: one matched by prop name, one matched by function name. Each test drives the `findBy*`
// surface — the only public entry into `parseOptions` — and reads back whether the trailing argument
// was split off as options or kept as a search term.
function named() {}

installMetroGlobals({
	modules: {
		1: { exports: { alpha: 1 } },
		2: { exports: { alpha: 1, extra: true } },
		// Exports that *are* a function (assigned by reference; the fixture handles non-plain exports).
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
		// If `{ all: true }` were treated as a prop name, no module would match and the result would be
		// an empty array; instead it is split off as options, so `all` collects every `alpha` module.
		const found = Metro.findByProps('alpha', { all: true }) as any[];

		expect(Array.isArray(found)).toBe(true);
		expect(found).toHaveLength(2);
	});

	test('with no trailing object, every argument is a search term', () => {
		// Both props required; only module 2 exposes `extra`.
		const found = Metro.findByProps('alpha', 'extra') as any;

		expect(found).toEqual({ alpha: 1, extra: true });
	});

	test('a trailing array is kept as a search term, not mistaken for options', () => {
		// The predicate rejects arrays, so `['alpha']` stays a term. `byProps` receives an array as a
		// prop name — `mdl[['alpha']]` coerces to `mdl['alpha']`, which is present, so it still matches.
		const found = Metro.findByProps(['alpha'] as any) as any;

		expect(found).toEqual({ alpha: 1 });
	});

	test('findByName splits its trailing options object off the name terms', () => {
		const found = Metro.findByName('named', { interop: false }) as any;

		// interop:false returns the whole exports; here the export *is* the function.
		expect(found).toBe(named);
	});
});
