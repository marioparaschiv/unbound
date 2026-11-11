import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { FluxAction, FluxChangeListener } from '@unbound-app/types/flux';
import type { SettingsEntry } from '@unbound-app/types/settings';
import type { AddonManifest } from '@unbound-app/types';

import { createCacheMock } from './helpers/cache';

type Listener = (action: FluxAction) => void;
type Interceptor = (action: FluxAction) => boolean;

const ID = 'scope.wiring';

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
mock.module('~/metro/cache', () =>
	createCacheMock({
		state: { moduleFlags: {} },
		getModuleIds: () => [],
		hasModuleFlag: () => false,
		addModuleFlag: () => void 0,
		getModuleCacheForKey: () => void 0,
		isKeyMissing: () => false,
		getHintsForKey: () => void 0,
		markKeyMissing: () => void 0,
	}),
);
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

Object.assign(globalThis, { window: globalThis, modules: new Map() });

const patcher = await import('~/patcher/api');
const commands = await import('~/commands/api');
const storage = await import('~/storage/api');
const metro = { ...(await import('~/metro/search')), ...(await import('~/metro/wait')) };
const flux = await import('~/flux/api');
const settings = await import('~/settings/api');
const { registry } = await import('~/commands/registry');
const { data } = await import('~/metro/state');
const { Plugins } = await import('~/plugins/manager');
const { createAddonLocales } = await import('~/i18n/addon-locales');

// Metro's own listeners, such as the one serving module waits, are not the plugin's.
const metroListeners = data.listeners.size;

const seen: string[] = [];
const assetListeners = new Set<() => void>();
// The real `i18n` reaches Discord's MessageFormat; its addon locales need only a formatter.
const i18n = {
	createLocales: (
		fallback: Record<string, string>,
		source: Parameters<typeof createAddonLocales>[1],
	) => createAddonLocales(fallback, source, (messages, key) => messages[key] ?? key),
};
const assets = {
	onAssetRegistered(listener: () => void) {
		assetListeners.add(listener);

		return () => void assetListeners.delete(listener);
	},
};

function startPlugin(bundle: string) {
	const plugins = new Plugins();

	storage.getBucket('plugins').set('states', { [ID]: true });
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

function section(key: string): SettingsEntry {
	return {
		type: 'route',
		key,
		useTitle: () => key,
		parent: null,
		screen: { route: key, getComponent: () => () => null },
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
		moduleListeners: data.listeners.size - metroListeners,
		actionListeners: dispatcher.subscriptions.get('WIRING')?.size ?? 0,
		storeListeners: store.listeners.size,
		commands: commandsOf(ID),
	};
}

beforeEach(() => {
	seen.length = 0;
	Reflect.set(globalThis, 'React', { createElement: () => null });
	Reflect.set(globalThis, 'unbound', {
		patcher,
		metro,
		flux,
		storage,
		commands,
		settings,
		assets,
		i18n,
	});
	Reflect.set(globalThis, '__wiringSeen', seen);
	Reflect.set(globalThis, '__wiringStore', store);
});

afterEach(() => {
	storage.getBucket(ID).clear();
	storage.getBucket('other').clear();
	settings.removeSection('core', 'wired', 'removed');
	assetListeners.clear();

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
				unbound.metro.findLazy(() => false).then((mdl) => seen.push('lazy:' + mdl));
				unbound.storage.onChange(() => true, () => seen.push('change'));
				unbound.flux.onAction('WIRING', () => seen.push('action'));
				unbound.flux.interceptAction('WIRING', () => true);
				unbound.flux.onStoreChange(globalThis.__wiringStore, () => {});
				// What the build's locale module does before any command registers.
				unbound.i18n.createLocales({ PING: 'Ping' });
				commands.register({ wired: { description: 'PING', execute: () => 'pong' } });
				unbound.commands.register({ shared: { description: 'PING', execute: () => 'pong' } });
				globalThis.__wiringLate = () => unbound.flux.onAction('WIRING', () => seen.push('late'));
			},
			stop() {},
		})`);

		expect(registered()).toEqual({
			moduleListeners: 1,
			actionListeners: 1,
			storeListeners: 1,
			commands: ['shared', 'wired'],
		});

		await flux.dispatch({ type: 'WIRING' });
		storage.getBucket(ID).set('key', 1);

		expect(dispatcher.handled).toEqual([]);
		expect(seen).toEqual(['change']);

		await plugins.stop(ID);
		Reflect.apply(Reflect.get(globalThis, '__wiringLate'), undefined, []);
		await flux.dispatch({ type: 'WIRING' });
		storage.getBucket(ID).set('key', 2);

		expect(registered()).toEqual({
			moduleListeners: 0,
			actionListeners: 0,
			storeListeners: 0,
			commands: [],
		});
		expect(dispatcher.handled).toEqual([{ type: 'WIRING' }]);
		expect(seen).toEqual(['change', 'lazy:undefined']);
	});

	test('a listener the plugin removes through its returned function stays removed', async () => {
		const plugins = startPlugin(`({
			start() {
				unbound.metro.onModuleLoad(() => {})();
				unbound.storage.onChange(() => true, () => globalThis.__wiringSeen.push('change'))();
			},
			stop() {},
		})`);

		storage.getBucket(ID).set('key', 1);

		expect(data.listeners.size).toBe(metroListeners);
		expect(seen).toEqual([]);

		await plugins.stop(ID);

		expect(data.listeners.size).toBe(metroListeners);
	});

	test('a settings section the plugin registers is gone after it stops, and one it did not register stays', async () => {
		settings.registerSection(section('core'));

		const plugins = startPlugin(`({
			start() {
				const entry = (key) => ({ type: 'route', key, useTitle: () => key, parent: null, screen: { route: key, getComponent: () => () => null } });

				unbound.settings.registerSection(entry('wired'), entry('removed'));
				unbound.settings.removeSection('removed');
			},
			stop() {},
		})`);

		expect(Object.keys(settings.getSections()).toSorted()).toEqual(['core', 'wired']);

		await plugins.stop(ID);

		expect(Object.keys(settings.getSections())).toEqual(['core']);
	});

	test('an asset registration listener is removed after the plugin stops', async () => {
		const plugins = startPlugin(`({
			start() {
				unbound.assets.onAssetRegistered(() => {});
			},
			stop() {},
		})`);

		expect(assetListeners.size).toBe(1);

		await plugins.stop(ID);

		expect(assetListeners.size).toBe(0);
	});

	test("getBucket with no name returns the plugin's own Bucket, and named Buckets stay reachable", async () => {
		const plugins = startPlugin(`({
			start() {
				unbound.storage.getBucket().set('greeting', 'hi');
				unbound.storage.getBucket('other').set('greeting', 'hello');
			},
			stop() {},
		})`);

		expect(storage.getBucket(ID).get('greeting', '')).toBe('hi');
		expect(storage.getBucket('other').get('greeting', '')).toBe('hello');
		expect(() => storage.getBucket()).toThrow('outside a plugin');

		await plugins.stop(ID);
	});

	test('an entry built with named exports has its scope disposed after its async stop', async () => {
		const plugins =
			startPlugin(`({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=function(){
			return {
				start() {
					unbound.flux.onAction('WIRING', () => globalThis.__wiringSeen.push('action'));
					unbound.flux.onStoreChange(globalThis.__wiringStore, () => {});
				},
				async stop() {
					await null;
					globalThis.__wiringSeen.push('stop');
				},
			};
		}();return this.__plugin;}})`);

		expect(registered()).toMatchObject({ actionListeners: 1, storeListeners: 1 });

		await plugins.stop(ID);
		await flux.dispatch({ type: 'WIRING' });

		expect(registered()).toMatchObject({ actionListeners: 0, storeListeners: 0 });
		expect(seen).toEqual(['stop']);
	});
});
