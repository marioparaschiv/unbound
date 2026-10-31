import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { makeManifest, resetDevice, states } from './helpers/addons';

const patcherApi = await import('~/patcher/api');
const { Plugins } = await import('~/plugins/manager');

type Greeter = {
	greet: (name: string) => string;
};

type TimerHandle = ReturnType<typeof setTimeout>;

const ID = 'scope.example';
const realTimers = {
	setTimeout: globalThis.setTimeout,
	setInterval: globalThis.setInterval,
	clearTimeout: globalThis.clearTimeout,
	clearInterval: globalThis.clearInterval,
};

let live: Set<TimerHandle>;
let target: Greeter;

function recordTimers() {
	live = new Set();

	Object.assign(globalThis, {
		setTimeout: (callback: () => void, delay?: number) => {
			const handle = realTimers.setTimeout(callback, delay);

			live.add(handle);

			return handle;
		},
		setInterval: (callback: () => void, delay?: number) => {
			const handle = realTimers.setInterval(callback, delay);

			live.add(handle);

			return handle;
		},
		clearTimeout: (handle: TimerHandle) => {
			live.delete(handle);
			realTimers.clearTimeout(handle);
		},
		clearInterval: (handle: TimerHandle) => {
			live.delete(handle);
			realTimers.clearInterval(handle);
		},
	});
}

function startPlugin(bundle: string) {
	const plugins = new Plugins();

	plugins.load(bundle, makeManifest(ID));
	expect(plugins.errors.get(ID)).toBeUndefined();

	return plugins;
}

beforeEach(() => {
	resetDevice();
	recordTimers();
	states[ID] = true;
	target = { greet: (name) => `hello ${name}` };
	Reflect.set(globalThis, 'window', globalThis);
	Reflect.set(globalThis, 'React', { createElement: () => null });
	Reflect.set(globalThis, 'unbound', { patcher: patcherApi, marker: 'initial' });
	Reflect.set(globalThis, '__scopeTarget', target);
});

afterEach(() => {
	for (const handle of live) {
		realTimers.clearInterval(handle);
	}

	Object.assign(globalThis, realTimers);
	patcherApi.unpatchAll();
	globalThis.NativePlatform = undefined;

	for (const key of [
		'React',
		'unbound',
		'window',
		'__scopeTarget',
		'__scopeSeen',
		'UNBOUND_LOADER',
	]) {
		Reflect.deleteProperty(globalThis, key);
	}
});

describe('addon scope', () => {
	test('a plugin with an empty stop leaves no patch and no timer behind', async () => {
		const plugins = startPlugin(`({
			start() {
				patcher.after(globalThis.__scopeTarget, 'greet', ({ result }) => result + '!');
				setInterval(() => {}, 1000);
				setTimeout(() => {}, 60000);
			},
			stop() {},
		})`);

		expect(target.greet('you')).toBe('hello you!');
		expect(live.size).toBe(2);

		await plugins.stop(ID);

		expect(target.greet('you')).toBe('hello you');
		expect(live.size).toBe(0);
	});

	test('the scoped unbound serves the scoped patcher and reads everything else live', async () => {
		const plugins = startPlugin(`({
			start() {
				unbound.patcher.instead(globalThis.__scopeTarget, 'greet', () => 'scoped');
				globalThis.__scopeSeen = () => [unbound.marker, addon.id, typeof logger.info, 'patcher' in unbound];
			},
			stop() {},
		})`);

		Reflect.set(globalThis, 'unbound', { patcher: patcherApi, marker: 'replaced' });

		expect(target.greet('you')).toBe('scoped');
		expect(Reflect.apply(Reflect.get(globalThis, '__scopeSeen'), undefined, [])).toEqual([
			'replaced',
			ID,
			'function',
			true,
		]);

		await plugins.stop(ID);

		expect(target.greet('you')).toBe('hello you');
	});

	test('a bundle built against window.unbound still runs, unscoped', async () => {
		const plugins = startPlugin(`({
			start() {
				window.unbound.patcher.after(globalThis.__scopeTarget, 'greet', ({ result }) => result + '?');
			},
			stop() {},
		})`);

		expect(target.greet('you')).toBe('hello you?');

		await plugins.stop(ID);

		expect(target.greet('you')).toBe('hello you?');
	});

	test('each start gets a fresh scope', async () => {
		const plugins = startPlugin(`({
			start() {
				patcher.after(globalThis.__scopeTarget, 'greet', ({ result }) => result + '!');
				setInterval(() => {}, 1000);
			},
			stop() {},
		})`);

		await plugins.stop(ID);
		plugins.start(ID);

		expect(target.greet('you')).toBe('hello you!');
		expect(live.size).toBe(1);

		await plugins.stop(ID);

		expect(target.greet('you')).toBe('hello you');
		expect(live.size).toBe(0);
	});

	test('bytecode receives the globals in the order the bundle wrapper declares them', async () => {
		type CompiledGlobals = [
			react: object,
			unbound: object,
			addon: object,
			patcher: typeof patcherApi,
		];

		globalThis.UNBOUND_LOADER = { origin: 'test', version: '1.0.0', bytecodeVersion: 98 };
		globalThis.UNBOUND_PLUGINS = [
			{ manifest: { ...makeManifest(ID), folder: ID }, bundle: '({})' },
		];
		Object.defineProperty(globalThis, 'NativePlatform', {
			configurable: true,
			writable: true,
			value: {
				addons: {
					verify: () => ({ status: 'unsigned' }),
					evaluateBytecode:
						() =>
						(...[, , , patcher]: CompiledGlobals) => ({
							start: () =>
								patcher.after(target, 'greet', ({ result }) => `${result}#`),
							stop: () => {},
						}),
				},
			},
		});

		const plugins = new Plugins();

		plugins.initialize();
		globalThis.UNBOUND_PLUGINS = [];

		expect(target.greet('you')).toBe('hello you#');

		await plugins.stop(ID);

		expect(target.greet('you')).toBe('hello you');
	});
});
