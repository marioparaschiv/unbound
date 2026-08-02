import { describe, expect, test, beforeEach } from 'bun:test';

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

beforeEach(() => {
	Cache.state.modules = {};
	data.cache.clear();
	blacklist.clear();
	data.listeners.clear();
});

describe('bulk', () => {
	test('results are positionally aligned with the items', () => {
		const [alpha, beta] = Metro.bulk({ filter: byProps('alpha') }, { filter: byProps('beta') });

		expect(alpha).toEqual({ alpha: 1 });
		expect(beta).toEqual({ beta: 2 });
	});

	test('an item with all: true collects every match into an array in its slot', () => {
		const [alphas, beta] = Metro.bulk(
			{ filter: byProps('alpha'), all: true },
			{ filter: byProps('beta') },
		);

		expect(Array.isArray(alphas)).toBe(true);
		expect(alphas).toHaveLength(2);
		expect(beta).toEqual({ beta: 2 });
	});
});

describe('findLazy', () => {
	test('resolves synchronously when a match already exists', () => {
		const result = Metro.findLazy(byProps('alpha'));

		// A synchronous hit returns the module itself, not a promise.
		expect(result).toEqual({ alpha: 1 });
	});

	test('FINDING: a miss short-circuits to find()’s null, never entering the wait', () => {
		// find() returns `null` (not `undefined`) on no-match, but findLazy only treats `undefined` as
		// "not found" (`if (existing !== void 0) return existing`). Since find never yields `undefined`,
		// the listener-wait and signal-abort branches below the guard are unreachable: findLazy resolves
		// synchronously to `null` and registers no listener. Documented so restoring the wait (guarding
		// on `!= null` / falsy) is a deliberate change with a red test to flip.
		const result = Metro.findLazy(byProps('deferred'));

		expect(result).toBeNull();
		expect(data.listeners.size).toBe(0);
	});
});
