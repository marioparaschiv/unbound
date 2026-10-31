import type { FluxAction, FluxChangeListener } from '@unbound-app/types/flux';
import type { AddonManifest } from '@unbound-app/types';
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

type Listener = (action: FluxAction) => void;
type Interceptor = (action: FluxAction) => boolean;

const ID = 'scope.wiring';

// Mirrors Discord's dispatcher: interceptors run first and a truthy one drops the action.
const dispatcher = {
	subscriptions: new Map<string, Set<Listener>>(),
	interceptors: [] as Interceptor[],
	handled: [] as FluxAction[],
	dispatch(action: FluxAction) {
		if (this.interceptors.some((interceptor) => interceptor(action))) {
			return Promise.resolve();
		}

		this.handled.push(action);

		for (const listener of this.subscriptions.get(action.type) ?? []) listener(action);

		return Promise.resolve();
	},
	subscribe(type: string, listener: Listener) {
		const listeners = this.subscriptions.get(type) ?? new Set<Listener>();

		listeners.add(listener);
		this.subscriptions.set(type, listeners);
	},
	unsubscribe(type: string, listener: Listener) {
		this.subscriptions.get(type)?.delete(listener);
	},
	addInterceptor(interceptor: Interceptor) {
		this.interceptors.push(interceptor);
	},
};

const store = {
	listeners: new Set<FluxChangeListener>(),
	getName: () => 'WiringStore',
	addChangeListener(listener: FluxChangeListener) {
		store.listeners.add(listener);
	},
	removeChangeListener(listener: FluxChangeListener) {
		store.listeners.delete(listener);
	},
};

mock.module('~/flux/modules', () => ({ Dispatcher: dispatcher, Flux: {}, FluxHooks: {} }));
mock.module('~/metro/cache', () => ({
	default: {
		moduleIds: [],
		hasModuleFlag: () => false,
		addModuleFlag: () => void 0,
		getModuleCacheForKey: () => void 0,
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
mock.module('react-native', () => ({
	Alert: { alert: () => undefined },
	NativeModules: {},
	Platform: { OS: 'ios' },
	TurboModuleRegistry: { get: () => undefined },
}));

Object.assign(globalThis, { window: globalThis, modules: new Map(), $$DEV$$: false });

const patcher = await import('~/patcher/api');
const commands = await import('~/commands/api');
const storage = await import('~/storage/api');
const metro = await import('~/metro/search');
const flux = await import('~/flux/api');
const { registry } = await import('~/commands/registry');
const { data } = await import('~/metro/state');
const { Plugins } = await import('~/plugins/manager');

const seen: string[] = [];

function startPlugin(bundle: string) {
	const plugins = new Plugins();

	storage.set('plugins', 'states', { [ID]: true });
	plugins.load(bundle, manifest());
	expect(plugins.errors.get(ID)).toBeUndefined();

	return plugins;
}

function manifest(): AddonManifest {
	return {
		id: ID,
		name: ID,
		description: 'test',
		authors: [{ name: 'Mario', id: '1' }],
		main: 'index.js',
		version: '1.0.0',
	};
}

function commandsOf(owner: string) {
	return registry
		.snapshot()
		.sections.flatMap((view) => view.commands)
		.filter((record) => record.owner === owner)
		.map((record) => record.path.join(' '))
		.toSorted();
}

function registered() {
	return {
		moduleListeners: data.listeners.size,
		actionListeners: dispatcher.subscriptions.get('WIRING')?.size ?? 0,
		storeListeners: store.listeners.size,
		commands: commandsOf(ID),
	};
}

beforeEach(() => {
	seen.length = 0;
	Reflect.set(globalThis, 'React', { createElement: () => null });
	Reflect.set(globalThis, 'unbound', { patcher, metro, flux, storage, commands });
	Reflect.set(globalThis, '__wiringSeen', seen);
	Reflect.set(globalThis, '__wiringStore', store);
});

afterEach(() => {
	storage.clear(ID);
	storage.clear('other');

	for (const key of ['React', 'unbound', '__wiringSeen', '__wiringStore', '__wiringLate']) {
		Reflect.deleteProperty(globalThis, key);
	}
});

describe('addon scope wiring', () => {
	test('a plugin using every scoped part, with an empty stop, leaves nothing registered', async () => {
		const plugins = startPlugin(`({
			start() {
				const seen = globalThis.__wiringSeen;

				unbound.metro.onModuleLoad(() => {});
				unbound.metro.addListener(() => {});
				unbound.metro.findLazy(() => false).then((mdl) => seen.push('lazy:' + mdl));
				unbound.storage.getBucket().addListener(() => true, () => seen.push('bucket'));
				unbound.storage.onChange(() => true, () => seen.push('change'));
				unbound.flux.onAction('WIRING', () => seen.push('action'));
				unbound.flux.interceptAction('WIRING', () => true);
				unbound.flux.onStoreChange(globalThis.__wiringStore, () => {});
				commands.register({ wired: { description: 'Ping', execute: () => 'pong' } });
				unbound.commands.register({ shared: { description: 'Ping', execute: () => 'pong' } });
				globalThis.__wiringLate = () => unbound.flux.onAction('WIRING', () => seen.push('late'));
			},
			stop() {},
		})`);

		expect(registered()).toEqual({
			moduleListeners: 3,
			actionListeners: 1,
			storeListeners: 1,
			commands: ['shared', 'wired'],
		});

		await flux.dispatch({ type: 'WIRING' });
		storage.set(ID, 'key', 1);

		expect(dispatcher.handled).toEqual([]);
		expect(seen).toEqual(['bucket', 'change']);

		await plugins.stop(ID);
		Reflect.apply(Reflect.get(globalThis, '__wiringLate'), undefined, []);
		await flux.dispatch({ type: 'WIRING' });
		storage.set(ID, 'key', 2);

		expect(registered()).toEqual({
			moduleListeners: 0,
			actionListeners: 0,
			storeListeners: 0,
			commands: [],
		});
		expect(dispatcher.handled).toEqual([{ type: 'WIRING' }]);
		expect(seen).toEqual(['bucket', 'change', 'lazy:undefined']);
	});

	test('a listener the plugin removes by reference stays removed', async () => {
		const plugins = startPlugin(`({
			start() {
				function listener() {}

				function callback() {
					globalThis.__wiringSeen.push('change');
				}

				unbound.metro.addListener(listener);
				unbound.metro.removeListener(listener);
				unbound.storage.onChange(() => true, callback);
				unbound.storage.removeListener(callback);
			},
			stop() {},
		})`);

		storage.set(ID, 'key', 1);

		expect(data.listeners.size).toBe(0);
		expect(seen).toEqual([]);

		await plugins.stop(ID);

		expect(data.listeners.size).toBe(0);
	});

	test("getBucket with no name returns the plugin's own Bucket, and named Buckets stay reachable", async () => {
		const plugins = startPlugin(`({
			start() {
				unbound.storage.getBucket().set('greeting', 'hi');
				unbound.storage.getStore().set('farewell', 'bye');
				unbound.storage.getBucket('other').set('greeting', 'hello');
			},
			stop() {},
		})`);

		expect(storage.get(ID, 'greeting', '')).toBe('hi');
		expect(storage.get(ID, 'farewell', '')).toBe('bye');
		expect(storage.get('other', 'greeting', '')).toBe('hello');
		expect(() => storage.getBucket()).toThrow('outside a plugin');

		await plugins.stop(ID);
	});
});
