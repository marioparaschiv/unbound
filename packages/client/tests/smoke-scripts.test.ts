import { describe, expect, mock, test } from 'bun:test';

mock.module('~/flux/modules', () => ({
	Dispatcher: {
		subscribe: () => undefined,
		unsubscribe: () => undefined,
		dispatch: () => undefined,
	},
	Flux: {},
	FluxHooks: {},
}));
mock.module('~/metro/cache', () => ({
	default: {
		moduleIds: [],
		hasModuleFlag: () => false,
		addModuleFlag: () => void 0,
		getModuleCacheForKey: () => void 0,
		getHintsForKey: () => void 0,
		markKeyMissing: () => void 0,
	},
	ModuleFlags: { BLACKLISTED: 1 },
}));
mock.module('~/native/fs', () => ({
	default: {
		documentsPath: '/docs',
		writeFile: async () => void 0,
		readFile: async () => '',
		removeFile: async () => true,
		exists: async () => false,
	},
}));
function mockReactNative() {
	mock.module('react-native', () => ({
		Alert: { alert: () => undefined },
		NativeModules: {},
		Platform: { OS: 'android' },
		TurboModuleRegistry: { get: () => undefined },
	}));
}

mockReactNative();

Object.assign(globalThis, {
	NativePlugin: {
		apiVersion: '1.0.0',
		capabilities: ['native.ffi.call', 'native.ffi.symbols'],
		ffi: { symbol: () => ({}), call: () => undefined },
	},
	window: globalThis,
	modules: new Map(),
	$$DEV$$: false,
	React: { createElement: () => null },
});

const plugins = await import('~/plugins/api');
const storage = await import('~/storage/api');

const SCRIPTS = new URL('../../loader/tools/smoke_scripts/', import.meta.url);

Reflect.set(globalThis, 'unbound', { plugins, storage });

const AsyncFunction: new (body: string) => () => Promise<string> = Object.getPrototypeOf(
	async () => '',
).constructor;

async function runSmokeScript(name: string): Promise<string> {
	const helpers = await Bun.file(new URL('fault-helpers.js', SCRIPTS)).text();
	const script = await Bun.file(new URL(name, SCRIPTS)).text();
	const run = new AsyncFunction(`return ${script.replace('__FAULT_HELPERS__', helpers.trim())}`);

	return String(await run());
}

describe('the smoke test fault scripts', () => {
	test('find a plugin that throws on start marked failed with its error', async () => {
		const result = JSON.parse(await runSmokeScript('throw-on-start.js'));

		expect(result).toMatchObject({ name: 'throw on start', problem: '' });
	});

	test('arm the crash fixture and read its state back through the public API', async () => {
		expect(await runSmokeScript('arm-crash.js')).toBe('armed');

		await Bun.sleep(400);

		const result = JSON.parse(await runSmokeScript('check-crash.js'));

		expect(result.name).toBe('native crash on start');
		expect(result.observed).toContain('after the relaunch');
	});
});
