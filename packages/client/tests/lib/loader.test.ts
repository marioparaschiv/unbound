import { describe, expect, test, beforeEach } from 'bun:test';

import { defineGlobal } from '../helpers/metro-fixture';

/** The host globals `~/lib/loader` reads: the registry factory plus both native entry points. */
interface LoaderWindow {
	modules?: Map<number, unknown>;
	__c?: () => Map<number, unknown> | undefined;
	__fbBatchedBridge?: FbBatchedBridge;
	RN$AppRegistry?: RNAppRegistry;
	Object?: ObjectConstructor;
}

const alerts: string[] = [];

const loaderWindow: LoaderWindow = { Object };
defineGlobal<LoaderWindow>('window', loaderWindow);
defineGlobal<(message: string) => void>('alert', (message) => void alerts.push(message));

const deferUntilReady = (await import('~/lib/loader')).default;

/** Reads a host global without the client's own narrowing, so leaked values stay observable. */
function readGlobal(name: string): unknown {
	return (globalThis as Record<string, unknown>)[name];
}

/** Removes a host global the loader or a test installed on `globalThis`. */
function clearGlobal(name: string): void {
	delete (globalThis as Record<string, unknown>)[name];
}

/** Builds a `__r` stand-in that records the ids it was called with. */
function makeRequire(calls: number[]): MetroRequire {
	const metroRequire = ((id: number) => void calls.push(id)) as MetroRequire;
	metroRequire.importAll = metroRequire;

	return metroRequire;
}

/** Installs the patched `__r` by assigning through the loader's setter, then reads it back. */
function installRequire(original: MetroRequire): MetroRequire {
	globalThis.__r = original;

	return globalThis.__r;
}

/** A batched bridge whose callable modules are limited to `callable`. */
function makeBridge(callable: string[], log: string[]): FbBatchedBridge {
	return {
		getCallableModule: (name) => (callable.includes(name) ? { name } : undefined),
		callFunctionReturnFlushedQueue: (...args) => void log.push(`direct:${args[0]}`),
		__callFunction: (...args) => void log.push(`replay:${args[0]}`),
		flushedQueue: () => 'held',
	};
}

beforeEach(() => {
	alerts.length = 0;

	delete loaderWindow.modules;
	delete loaderWindow.__c;
	delete loaderWindow.__fbBatchedBridge;
	delete loaderWindow.RN$AppRegistry;
	loaderWindow.Object = Object;

	// `deferUntilReady` only installs its accessors when `__r` is absent, and the descriptor it leaves
	// behind survives the module singleton. Drop it so every test starts from the un-hooked host.
	clearGlobal('__r');
	clearGlobal('__d');
});

describe('deferUntilReady', () => {
	test('installs the __r hook without running onReady', () => {
		let ran = false;
		deferUntilReady(async () => void (ran = true));

		expect(ran).toBe(false);
		expect(Object.getOwnPropertyDescriptor(globalThis, '__r')?.get).toBeDefined();
	});

	test('assigning __r swaps in a patched require, leaving the original reachable', () => {
		deferUntilReady(async () => {});

		const calls: number[] = [];
		const original = makeRequire(calls);
		const patched = installRequire(original);

		expect(patched).not.toBe(original);
		expect(typeof patched).toBe('function');
	});

	test('a non-zero id passes straight through to the original require', () => {
		deferUntilReady(async () => {});

		const calls: number[] = [];
		const patched = installRequire(makeRequire(calls));

		patched(5);
		patched(12);

		expect(calls).toEqual([5, 12]);
	});

	test('__r(0) runs onReady before the original run-application call', async () => {
		const order: string[] = [];
		const calls: number[] = [];

		deferUntilReady(async () => void order.push('onReady'));

		const patched = installRequire(makeRequire(calls));
		patched(0);

		expect(calls).toEqual([]);

		await Promise.resolve();
		await Promise.resolve();

		expect(order).toEqual(['onReady']);
		expect(calls).toEqual([0]);
	});

	test('the patched require unpatches itself after the first __r(0)', async () => {
		let readyRuns = 0;
		const calls: number[] = [];

		deferUntilReady(async () => void readyRuns++);

		installRequire(makeRequire(calls));
		globalThis.__r(0);
		await flush();

		expect(readyRuns).toBe(1);
		expect(calls).toEqual([0]);

		globalThis.__r(0);
		await flush();

		expect(readyRuns).toBe(1);
		expect(calls).toEqual([0, 0]);
	});
});

describe('ensureModules', () => {
	test('materialises window.modules from the registry factory', () => {
		const registry = new Map<number, unknown>([[1, { exports: {} }]]);
		loaderWindow.__c = () => registry;

		deferUntilReady(async () => {});
		installRequire(makeRequire([]))(0);

		expect(loaderWindow.modules).toBe(registry);
	});

	test('an absent registry factory leaves modules unset', () => {
		deferUntilReady(async () => {});
		installRequire(makeRequire([]))(0);

		expect(loaderWindow.modules).toBeUndefined();
	});

	test('an already-populated registry is never re-read from the factory', () => {
		const existing = new Map<number, unknown>();
		let factoryCalls = 0;

		loaderWindow.modules = existing;
		loaderWindow.__c = () => {
			factoryCalls++;

			return new Map();
		};

		deferUntilReady(async () => {});
		installRequire(makeRequire([]))(0);

		expect(factoryCalls).toBe(0);
		expect(loaderWindow.modules).toBe(existing);
	});

	test('a factory returning nothing leaves modules unset', () => {
		loaderWindow.__c = () => undefined;

		deferUntilReady(async () => {});
		installRequire(makeRequire([]))(0);

		expect(loaderWindow.modules).toBeUndefined();
	});

	test('FINDING: the __d getter returns globalThis.value, not the stored define', () => {
		// The accessor pair is installed on `globalThis`, so `this.value` inside the getter resolves to
		// `globalThis.value` - a shared, unrelated slot. Correct behaviour is to close over a local
		// variable the way `__r` does, so reading `__d` yields the function that was assigned to it.
		deferUntilReady(async () => {});

		const define: MetroDefine = () => {};
		globalThis.__d = define;

		expect(readGlobal('__d')).toBe(define);

		defineGlobal<string>('value', 'leaked');
		expect(readGlobal('__d')).toBe('leaked');

		clearGlobal('value');
	});

	test('reading __d materialises the registry as a side effect', () => {
		const registry = new Map<number, unknown>();
		loaderWindow.__c = () => registry;

		deferUntilReady(async () => {});
		void globalThis.__d;

		expect(loaderWindow.modules).toBe(registry);

		clearGlobal('value');
	});
});

describe('holdNativeCalls', () => {
	test('AppRegistry bridge calls are held and returned the flushed queue', async () => {
		const log: string[] = [];
		const bridge = makeBridge(['AppRegistry'], log);
		loaderWindow.__fbBatchedBridge = bridge;

		deferUntilReady(async () => {});
		installRequire(makeRequire([]))(0);

		const result = bridge.callFunctionReturnFlushedQueue('AppRegistry', 'runApplication');

		expect(result).toBe('held');
		expect(log).toEqual([]);

		await flush();

		expect(log).toEqual(['replay:AppRegistry']);
	});

	test('a callable non-AppRegistry module passes through untouched', async () => {
		const log: string[] = [];
		const bridge = makeBridge(['Timers'], log);
		loaderWindow.__fbBatchedBridge = bridge;

		deferUntilReady(async () => {});
		installRequire(makeRequire([]))(0);

		bridge.callFunctionReturnFlushedQueue('Timers', 'callTimers');

		expect(log).toEqual(['direct:Timers']);

		await flush();

		expect(log).toEqual(['direct:Timers']);
	});

	test('a held call whose module is still uncallable on resume is dropped', async () => {
		const log: string[] = [];
		const callable: string[] = [];
		const bridge = makeBridge(callable, log);
		loaderWindow.__fbBatchedBridge = bridge;

		deferUntilReady(async () => {});
		installRequire(makeRequire([]))(0);

		bridge.callFunctionReturnFlushedQueue('NotRegistered', 'noop');

		await flush();

		expect(log).toEqual([]);
	});

	test('a module registered while its call is held is replayed on resume', async () => {
		const log: string[] = [];
		const callable: string[] = [];
		const bridge = makeBridge(callable, log);
		loaderWindow.__fbBatchedBridge = bridge;

		deferUntilReady(async () => {});
		installRequire(makeRequire([]))(0);

		bridge.callFunctionReturnFlushedQueue('LateModule', 'noop');
		callable.push('LateModule');

		await flush();

		expect(log).toEqual(['replay:LateModule']);
	});

	test('RN$AppRegistry.runApplication is held then replayed with its original args', async () => {
		const runs: unknown[][] = [];
		const registry: RNAppRegistry = {
			runApplication: (...args) => void runs.push(args),
		};
		loaderWindow.RN$AppRegistry = registry;

		deferUntilReady(async () => {});
		installRequire(makeRequire([]))(0);

		registry.runApplication('Discord', { rootTag: 1 });

		expect(runs).toEqual([]);

		await flush();

		expect(runs).toEqual([['Discord', { rootTag: 1 }]]);
	});

	test('neither native entry point present is a no-op', async () => {
		const calls: number[] = [];

		deferUntilReady(async () => {});
		installRequire(makeRequire(calls))(0);

		await flush();

		expect(calls).toEqual([0]);
	});

	test('originals are restored before the run-application call reaches the host', async () => {
		const registry: RNAppRegistry = { runApplication: () => {} };
		const pristine = registry.runApplication;
		loaderWindow.RN$AppRegistry = registry;

		let atRunApplication: unknown;
		const calls: number[] = [];
		const original = ((id: number) => {
			calls.push(id);
			atRunApplication = registry.runApplication;
		}) as MetroRequire;
		original.importAll = original;

		deferUntilReady(async () => {});
		installRequire(original)(0);

		expect(registry.runApplication).not.toBe(pristine);

		await flush();

		expect(calls).toEqual([0]);
		expect(atRunApplication).toBe(pristine);
	});

	test('held calls replay in the order they arrived', async () => {
		const log: string[] = [];
		const registry: RNAppRegistry = {
			runApplication: (...args) => void log.push(`registry:${args[0]}`),
		};
		const bridge = makeBridge(['AppRegistry'], log);

		loaderWindow.__fbBatchedBridge = bridge;
		loaderWindow.RN$AppRegistry = registry;

		deferUntilReady(async () => {});
		installRequire(makeRequire([]))(0);

		registry.runApplication('first');
		bridge.callFunctionReturnFlushedQueue('AppRegistry', 'second');
		registry.runApplication('third');

		await flush();

		expect(log).toEqual(['registry:first', 'replay:AppRegistry', 'registry:third']);
	});
});

describe('runReady failures', () => {
	test('an Error rejection alerts the stack and still starts Discord', async () => {
		const calls: number[] = [];
		const failure = new Error('boom');

		deferUntilReady(async () => {
			throw failure;
		});
		installRequire(makeRequire(calls))(0);

		await flush();

		expect(alerts).toHaveLength(1);
		expect(alerts[0]).toContain('Unbound failed to initialize');
		expect(alerts[0]).toContain('boom');
		expect(calls).toEqual([0]);
	});

	test('a stackless object rejection falls back to String(error)', async () => {
		const calls: number[] = [];

		deferUntilReady(async () => {
			throw { toString: () => 'bare rejection' };
		});
		installRequire(makeRequire(calls))(0);

		await flush();

		expect(alerts).toEqual(['Unbound failed to initialize: bare rejection']);
		expect(calls).toEqual([0]);
	});

	// FINDING: `runReady` guards with `'stack' in error`, and `in` throws on a primitive. A string or
	// number rejection turns the handler that exists to report a failed initialization into a second
	// failure that escapes through the discarded `void runReady(...)` promise: no alert fires,
	// `original(0)` never runs, and the held native entry points are never restored, so Discord never
	// starts at all. The fix is `error instanceof Error ? error.stack : String(error)`, which degrades
	// exactly like the stackless-object case above.
	//
	// Skipped because the escaping rejection fails the bun run on its own, independently of the
	// assertions. The body asserts the corrected behaviour, so un-skip it alongside the fix.
	test.skip('a primitive rejection alerts and still starts Discord', async () => {
		const calls: number[] = [];

		deferUntilReady(async () => {
			throw 'plain string failure';
		});
		installRequire(makeRequire(calls))(0);

		await flush();

		expect(alerts).toEqual(['Unbound failed to initialize: plain string failure']);
		expect(calls).toEqual([0]);
	});
});

/** Drains the microtask queue so the `runReady().then(...)` continuation has settled. */
async function flush() {
	for (let i = 0; i < 8; i++) await Promise.resolve();
}
