import { describe, expect, test, beforeEach } from 'bun:test';

import { installMetroGlobals } from '../helpers/metro-fixture';

// One esModule-shaped module whose real payload lives on `.default`. The filter matches only that
// inner object, so every test forces the engine down its default-probe unwrap path and then varies
// interop/esModules/raw to pick which shape comes back.
installMetroGlobals({
	modules: {
		1: { esModule: true, exports: { default: { inner: 1 } } },
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

describe('searchExports interop', () => {
	test('interop: true (default) unwraps an esModule hit to its default export', () => {
		const found = Metro.find(byProps('inner'));

		expect(found).toEqual({ inner: 1 });
	});

	test('interop: false returns the whole exports object, default and all', () => {
		const found = Metro.find(byProps('inner'), { interop: false });

		expect(found).toHaveProperty('default');
		expect(found).toHaveProperty('__esModule', true);
		expect(found.default).toEqual({ inner: 1 });
	});

	test('esModules: false skips the default probe, so the inner match is never found', () => {
		const found = Metro.find(byProps('inner'), { esModules: false });

		expect(found).toBeNull();
	});

	test('raw: true returns the raw module record instead of its exports', () => {
		const found = Metro.find(byProps('inner'), { raw: true });

		expect(found).toHaveProperty('publicModule');
		expect(found).toHaveProperty('isInitialized', true);
		expect(found.publicModule.exports.default).toEqual({ inner: 1 });
	});
});
