import { describe, expect, test, beforeEach } from 'bun:test';

import type { ModuleFactory } from '../helpers/metro-fixture';

import { installMetroGlobals } from '../helpers/metro-fixture';

// `byProps` reads the requested prop off every module it scans. A module whose exports answer any
// read through a counting proxy therefore reports how many times the lazy proxy ran a search.
let scans = 0;

const probe: ModuleFactory = (_g, _r, _d, _a, moduleObject) => {
	moduleObject.exports = new Proxy(
		{ probe: true },
		{
			get(target, prop, receiver) {
				scans++;
				return Reflect.get(target, prop, receiver);
			},
		},
	);
};

installMetroGlobals({
	modules: {
		0: { factory: probe },
		1: { exports: { alpha: 1, shared: 'one' } },
		2: { exports: { beta: 2 } },
	},
});

const Metro = await import('~/api/metro');
const { data, blacklist } = await import('~/api/metro/state');
const Cache = (await import('~/lib/cache')).default;

beforeEach(() => {
	Cache.state.modules = {};
	data.cache.clear();
	blacklist.clear();
	scans = 0;
});

describe('lazy proxy resolution', () => {
	test('the proxy is returned without running a search', () => {
		Metro.findByProps('alpha', { lazy: true });

		expect(scans).toBe(0);
	});

	test('the first property access resolves once and the second reuses the cache', () => {
		const proxy = Metro.findByProps('alpha', { lazy: true });

		expect(proxy.alpha).toBe(1);
		expect(scans).toBeGreaterThan(0);

		// Emptying every search cache means any second resolution has to rescan the registry, so a
		// still-zero counter can only mean the proxy answered from its own memo.
		Cache.state.modules = {};
		data.cache.clear();
		scans = 0;

		expect(proxy.shared).toBe('one');
		expect(scans).toBe(0);
	});

	test('the module property yields the resolved exports through the trap branch', () => {
		const proxy = Metro.findByProps('beta', { lazy: true });

		expect(proxy.module).toEqual({ beta: 2 });
	});

	test('module read through the raw target getter reflects the resolved cache', () => {
		const proxy = Metro.findByProps('beta', { lazy: true });
		void proxy.beta;

		expect(Reflect.get(proxy, 'module', proxy)).toEqual({ beta: 2 });
	});

	test('FINDING: reading __METRO_LAZY__ forces the very resolution the marker exists to defer', () => {
		// The get trap resolves before checking the prop, so the marker meant to identify an
		// un-resolved proxy triggers the search and never reports the target's own `true`.
		const proxy = Metro.findByProps('alpha', { lazy: true });

		expect(proxy.__METRO_LAZY__).toBeUndefined();
		expect(scans).toBeGreaterThan(0);
	});

	test('a symbol property returns undefined without resolving', () => {
		const proxy = Metro.findByProps('alpha', { lazy: true });

		expect(proxy[Symbol.toPrimitive]).toBeUndefined();
		expect(scans).toBe(0);
	});

	test('an empty-string property returns undefined without resolving', () => {
		const proxy = Metro.findByProps('alpha', { lazy: true });

		expect(proxy['']).toBeUndefined();
		expect(scans).toBe(0);
	});

	test('a miss resolves to null and property reads yield undefined without throwing', () => {
		const proxy = Metro.findByProps('nonexistent', { lazy: true });

		expect(proxy.module).toBeNull();
		expect(proxy.anything).toBeUndefined();
	});

	test('FINDING: a missed search re-runs on every access because null never fills the cache', () => {
		// `cache ??= …` treats find()'s `null` miss as "still unresolved", so the registry is
		// rescanned per property read. A miss should be memoised like a hit.
		const proxy = Metro.findByProps('nonexistent', { lazy: true });

		void proxy.first;
		const afterFirst = scans;
		expect(afterFirst).toBeGreaterThan(0);

		void proxy.second;
		expect(scans).toBeGreaterThan(afterFirst);
	});
});

describe('lazy proxy set trap', () => {
	test('a write on a hit lands on the resolved module', () => {
		const proxy = Metro.findByProps('alpha', { lazy: true });
		proxy.injected = 'value';

		expect(Metro.findByProps('alpha').injected).toBe('value');
	});

	test('FINDING: a write on a miss is lost to a throwaway object', () => {
		// The set trap falls back to `cache ?? {}`, so on a miss the value is defined on a fresh
		// object that is immediately discarded. The write should fail loudly instead.
		const proxy = Metro.findByProps('nonexistent', { lazy: true });
		proxy.injected = 'value';

		expect(proxy.injected).toBeUndefined();
	});
});

describe('lazy proxy options handling', () => {
	test('MUTATION PROBE: resolving flips lazy to false on the caller-owned options object', () => {
		// The trap recurses with `Object.assign(options, { lazy: false })`, writing through the
		// caller's bag. A reused options object silently stops producing lazy proxies.
		const options: { lazy: boolean } = { lazy: true };
		const proxy = Metro.findByProps('shared', options);
		void proxy.shared;

		expect(options.lazy).toBe(false);
		expect(Metro.findByProps('shared', options)).toEqual({ alpha: 1, shared: 'one' });
	});
});
