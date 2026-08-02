import { describe, expect, test, beforeEach } from 'bun:test';

import { installMetroGlobals, defineGlobal, makeModule } from '../helpers/metro-fixture';

let throwingRuns = 0;
let healthyRuns = 0;

installMetroGlobals({
	modules: {
		2: {
			factory: (_g, _r, _d, _a, moduleObject) => {
				healthyRuns++;
				Object.assign(moduleObject.exports, { healthy: true });
			},
		},
		3: { exports: { plain: true } },
	},
});

const Metro = await import('~/api/metro');
const { data, blacklist } = await import('~/api/metro/state');
const Cache = (await import('~/lib/cache')).default;
const { ModuleFlags } = await import('~/lib/cache');

// Registered after the import-time walk: that walk wraps every factory it sees in a try/catch that
// swallows the throw, so only an unwrapped factory lets the exception reach `initializeModule`.
const THROWING_ID = 1;
window.modules.set(
	THROWING_ID,
	makeModule(
		{
			factory: () => {
				throwingRuns++;
				throw new Error('factory exploded');
			},
		},
		THROWING_ID,
	),
);

// `__r` is swapped per test to observe what initializeModule does to it; the real one is restored in
// beforeEach so later tests still run factories for real.
const realRequire = __r;

/**
 * @description Installs a stand-in `__r`, completing it with the `importAll` member the global's
 * type requires.
 * @param run The body the stand-in should execute.
 */
function stubRequire(run: (id: number) => unknown): void {
	const stub = run as MetroRequire;
	stub.importAll = realRequire.importAll;

	defineGlobal<MetroRequire>('__r', stub);
}

// Counts every `__r` entry so a short-circuit can be told apart from a re-run that happens to be
// idempotent.
let requireCalls = 0;

function countingRequire(): void {
	stubRequire((id) => {
		requireCalls++;
		return realRequire(id);
	});
}

beforeEach(() => {
	Cache.state.modules = {};
	Cache.state.moduleFlags = {};
	data.cache.clear();
	blacklist.clear();
	throwingRuns = 0;
	healthyRuns = 0;
	requireCalls = 0;
	defineGlobal<MetroRequire>('__r', realRequire);
});

describe('initializeModule failure handling', () => {
	test('a throwing factory returns false, blacklists the id, and persists the flag', () => {
		const result = Metro.initializeModule(THROWING_ID);

		expect(result).toBe(false);
		expect(throwingRuns).toBeGreaterThan(0);
		expect(blacklist.has(THROWING_ID)).toBe(true);
		expect(Cache.hasModuleFlag(THROWING_ID, ModuleFlags.BLACKLISTED)).toBe(true);
	});

	test('an already-blacklisted id short-circuits without touching __r', () => {
		blacklist.add(2);
		countingRequire();

		expect(Metro.initializeModule(2)).toBe(false);
		expect(requireCalls).toBe(0);
	});
});

describe('initializeModule short-circuits', () => {
	test('an initialized error-free module returns true without re-running __r', () => {
		Metro.initializeModule(2);
		const runsAfterFirst = healthyRuns;

		countingRequire();
		expect(Metro.initializeModule(2)).toBe(true);
		expect(requireCalls).toBe(0);
		expect(healthyRuns).toBe(runsAfterFirst);
	});

	test('an initialized module carrying hasError is re-run', () => {
		Metro.initializeModule(2);
		const runsAfterFirst = healthyRuns;

		window.modules.get(2)!.hasError = true;

		try {
			expect(Metro.initializeModule(2)).toBe(true);
			expect(healthyRuns).toBeGreaterThan(runsAfterFirst);
		} finally {
			window.modules.get(2)!.hasError = false;
		}
	});
});

describe('initializeModule global handler restoration', () => {
	test('the original handler is restored on the success path', () => {
		const original = () => {};
		ErrorUtils.setGlobalHandler(original);

		Metro.initializeModule(2);

		expect(ErrorUtils.getGlobalHandler()).toBe(original);
	});

	test('the original handler is restored on the throwing path', () => {
		const original = () => {};
		ErrorUtils.setGlobalHandler(original);

		Metro.initializeModule(THROWING_ID);

		expect(ErrorUtils.getGlobalHandler()).toBe(original);
	});
});

describe('initializeModule toString restoration', () => {
	test('a factory that overwrites Function.prototype.toString has it restored', () => {
		const overwritten = function toString() {
			return 'hijacked';
		};

		stubRequire(() => {
			Function.prototype.toString = overwritten;
			return undefined;
		});

		expect(Metro.initializeModule(3)).toBe(true);
		expect(Function.prototype.toString).toBe(data.origToString);
	});

	test('the restored descriptor stays configurable and writable', () => {
		stubRequire(() => {
			Function.prototype.toString = function toString() {
				return 'hijacked';
			};
			return undefined;
		});

		Metro.initializeModule(3);

		const descriptor = Object.getOwnPropertyDescriptor(Function.prototype, 'toString');

		expect(descriptor?.configurable).toBe(true);
		expect(descriptor?.writable).toBe(true);
	});
});

describe('initializeModule on an unknown id', () => {
	test('FINDING: an absent id reports success while initialising nothing', () => {
		// The `module?.isInitialized` guard falls through for a missing record, `__r` no-ops, and the
		// try block returns true. A lookup for an id the registry never held should return false.
		countingRequire();

		expect(Metro.initializeModule(9999)).toBe(true);
		expect(requireCalls).toBe(1);
		expect(window.modules.has(9999)).toBe(false);
		expect(blacklist.has(9999)).toBe(false);
		expect(Cache.hasModuleFlag(9999, ModuleFlags.BLACKLISTED)).toBe(false);
	});
});
