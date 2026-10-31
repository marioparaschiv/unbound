import type { AddonManifest, Plugin, PluginContext } from '@unbound-app/types';
import { mock } from 'bun:test';

import type { Addon, AddonState } from '~/addons/addon';

// The base Addons manager reaches native FS and storage through these modules, which pull in
// react-native. Stub both so the pure lifecycle logic loads under bun with no device harness.
export const writes: string[] = [];
export const states: Record<string, boolean> = {};
export const persists: number[] = [];
export const existingFiles = new Set<string>();

mock.module('~/native/fs', () => ({
	default: {
		documentsPath: '/docs',
		writeFile: async (path: string) => void writes.push(path),
		readFile: async () => '',
		removeFile: async () => true,
		exists: async (path: string) => existingFiles.has(path),
	},
}));

export const storedSettings = new Map<string, unknown>();
/** The bucket names managers opened their settings with, in construction order. */
export const openedBuckets: string[] = [];

/** A settings change a component re-renders on: one key written to one bucket. */
export type SettingsChange = { store: string; key: string };

type Subscription = {
	store: string;
	predicate?: (change: SettingsChange) => boolean;
};

/** What each `useBucket` call subscribed to, in call order. */
export const subscriptions: Subscription[] = [];

/**
 * @description Whether any recorded `useBucket` subscription re-renders on a change.
 * @param change The bucket and key written.
 * @returns Whether a subscriber would re-render.
 */
export function rerendersOn(change: SettingsChange): boolean {
	return subscriptions.some(
		({ store, predicate }) => store === change.store && (!predicate || predicate(change)),
	);
}

mock.module('~/storage/api', () => {
	const store = {
		get: <T>(key: string, fallback: T) =>
			key === 'states' ? states : ((storedSettings.get(key) as T | undefined) ?? fallback),
		set: <T>(key: string, value: T) => {
			if (key !== 'states') {
				storedSettings.set(key, value);
			}
		},
	};

	function getBucket(bucket: string) {
		openedBuckets.push(bucket);

		return store;
	}

	function useBucket(bucket: string, predicate?: Subscription['predicate']) {
		subscriptions.push({ store: bucket, predicate });

		return store;
	}

	return {
		default: {
			getBucket,
			get: <T>(_s: string, _k: string, d: T) => d,
			persist: async () => void persists.push(Date.now()),
		},
		getBucket,
		useBucket,
		getStore: getBucket,
		useSettingsStore: useBucket,
	};
});

mock.module('react-native', () => ({
	Alert: { alert: () => undefined },
	NativeModules: {},
	Platform: { OS: 'ios' },
	TurboModuleRegistry: { get: () => undefined },
	Switch: 'Switch',
	Text: 'Text',
	View: 'View',
}));

// Loaded dynamically after the mocks above: static imports hoist above `mock.module`, which would let
// the real react-native-backed fs/storage load before the stubs are registered.
export const { Addons } = require('~/addons/addons') as typeof import('~/addons/addons');

export const { createPluginContext } =
	require('~/native/plugin-context') as typeof import('~/native/plugin-context');

/**
 * @description Loads the four addon managers, which read Discord's modules off `window` while they load.
 * @returns The base class, with every kind's manager registered.
 */
export async function loadManagers() {
	Reflect.set(globalThis, 'window', globalThis);

	const { Manager } = await import('~/addons/manager');

	await import('~/plugins/manager');
	await import('~/themes/manager');
	await import('~/icon-packs/manager');
	await import('~/fonts/manager');

	return Manager;
}

/**
 * @description Builds a valid manifest for tests.
 * @param id The addon id.
 * @param version The version.
 * @returns The manifest.
 */
export function makeManifest(id: string, version: string = '1.0.0'): AddonManifest {
	return {
		id,
		name: id,
		description: 'test',
		authors: [{ name: 'Mario', id: '1' }],
		main: 'index.js',
		version,
	};
}

/**
 * @description Builds an addon instance that logs its lifecycle calls.
 * @param id The name logged for this instance.
 * @param log The log the calls are pushed to.
 * @param stopThrows Whether `stop()` throws after logging.
 * @returns The instance.
 */
export function makeInstance(id: string, log: string[], stopThrows: boolean = false) {
	return {
		start: () => void log.push(`start:${id}`),
		stop: () => {
			log.push(`stop:${id}`);

			if (stopThrows) {
				throw new Error('teardown blew up');
			}
		},
	};
}

export type SeededAddon = Omit<AddonState<Plugin>, 'context' | 'scope'> & { id: string };

/** A plugin manager whose bundles evaluate to logging instances named after their source. */
export class FakeAddons extends Addons<Plugin> {
	log: string[] = [];
	contexts: { disposed: boolean }[] = [];
	nextStartFails = false;
	nextInstanceStartFails = false;

	constructor() {
		super({
			kind: 'plugin',
			name: 'Plugins',
			directory: 'Unbound/Plugins',
			bucket: 'plugins',
			label: 'UNBOUND_PLUGINS',
			icon: 'PuzzlePieceIcon',
		});
	}

	initialize() {}

	protected handleBundle(bundle: string) {
		if (this.nextStartFails) {
			throw new Error('bundle threw on eval');
		}

		return {
			...makeInstance(bundle, this.log),
			start: () => {
				this.log.push(`start:${bundle}`);

				if (this.nextInstanceStartFails) {
					throw new Error('instance start failed');
				}
			},
		};
	}

	protected createContext(): PluginContext {
		const state = { disposed: false };

		this.contexts.push(state);

		return {
			...createPluginContext(makeManifest('test')),
			dispose: () => void (state.disposed = true),
		};
	}

	seed({ id, manifest, bundle, ...state }: SeededAddon): Addon<Plugin> {
		const entity = this.createAddon(manifest, bundle);

		Object.assign(this.stateOf(entity), state);
		this.entities.set(id, entity);

		return entity;
	}

	bundleOf(id: string): string | undefined {
		const entity = this.getEntity(id);

		return entity ? this.stateOf(entity).bundle : undefined;
	}

	setInstance(entity: Addon<Plugin>, instance: Plugin): void {
		this.stateOf(entity).instance = instance;
	}
}

/** Clears the recorded writes and persisted enabled states between tests. */
export function resetDevice() {
	writes.length = 0;
	persists.length = 0;
	storedSettings.clear();
	existingFiles.clear();

	for (const key of Object.keys(states)) {
		delete states[key];
	}
}
