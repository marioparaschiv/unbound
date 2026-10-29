import type { Addon, AddonManifest, PluginContext } from '@unbound-app/types';
import { mock } from 'bun:test';

// The base Addons manager reaches native FS and storage through these modules, which pull in
// react-native. Stub both so the pure lifecycle logic loads under bun with no device harness.
export const writes: string[] = [];
export const states: Record<string, boolean> = {};
export const persists: number[] = [];
export const existingFiles = new Set<string>();

mock.module('~/api/fs', () => ({
	default: {
		Documents: '/docs',
		write: async (path: string) => void writes.push(path),
		read: async () => '',
		rm: async () => true,
		exists: async (path: string) => existingFiles.has(path),
	},
}));

export const storedSettings = new Map<string, unknown>();

mock.module('~/api/storage', () => {
	const store = {
		get: <T>(key: string, fallback: T) =>
			key === 'states' ? states : ((storedSettings.get(key) as T | undefined) ?? fallback),
		set: <T>(key: string, value: T) => {
			if (key !== 'states') {
				storedSettings.set(key, value);
			}
		},
	};

	return {
		default: {
			getStore: () => store,
			get: <T>(_s: string, _k: string, d: T) => d,
			persist: async () => void persists.push(Date.now()),
		},
		getStore: () => store,
	};
});

mock.module('react-native', () => ({
	Alert: { alert: () => undefined },
	NativeModules: {},
	TurboModuleRegistry: { get: () => undefined },
	Switch: 'Switch',
	Text: 'Text',
	View: 'View',
}));

// Loaded dynamically after the mocks above: static imports hoist above `mock.module`, which would let
// the real react-native-backed fs/storage load before the stubs are registered.
export const { ManagerType } = await import('~/managers/base');
export const { Addons } = await import('~/managers/addons');
export const { createPluginContext } = await import('~/api/native-runtime');

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
		icon: '',
		updates: '',
		main: 'index.js',
		version,
		folder: '',
		path: '',
		url: '',
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

/** A plugin manager whose bundles evaluate to logging instances named after their source. */
export class FakeAddons extends Addons<Addon> {
	log: string[] = [];
	contexts: { disposed: boolean }[] = [];
	nextStartFails = false;
	nextInstanceStartFails = false;

	constructor() {
		super(ManagerType.PLUGINS);
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

	protected get entityType() {
		return 'plugin' as const;
	}

	protected createContext(): PluginContext {
		const state = { disposed: false };

		this.contexts.push(state);

		return {
			...createPluginContext(makeManifest('test')),
			dispose: () => void (state.disposed = true),
		};
	}

	seed(entity: Addon) {
		this.entities.set(entity.id, entity);
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
