import type {
	NativePlatformSettings,
	NativeSettingsChange,
	SettingsObject,
	SettingsValue,
} from '@unbound-app/types';
import isEmpty from '@unbound-app/utils/is-empty';

export type SettingsStores = Record<string, SettingsObject>;

export type SettingsBackend = {
	read: (store: string, key: string) => SettingsValue | undefined;
	readAll: () => SettingsStores;
	write: (change: NativeSettingsChange) => void;
	flush: () => void;
};

type LazyNativeSettings = NativePlatformSettings &
	Required<Pick<NativePlatformSettings, 'get' | 'stage' | 'flush'>>;

function isSettingsObject(value: SettingsValue | undefined): value is SettingsObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasLazyAccess(bridge: NativePlatformSettings | undefined): bridge is LazyNativeSettings {
	return (
		typeof bridge?.get === 'function' &&
		typeof bridge.stage === 'function' &&
		typeof bridge.flush === 'function'
	);
}

/**
 * @description Keeps settings in the loader's native store and reads them on demand, so JS never holds the whole file.
 * @param bridge The loader's settings bridge.
 * @returns The backend.
 */
export function createNativeBackend(bridge: LazyNativeSettings): SettingsBackend {
	return {
		read: (store, key) => bridge.get(store, key) as SettingsValue | undefined,
		readAll() {
			const stores = bridge.get();

			return isSettingsObject(stores as SettingsValue) ? (stores as SettingsStores) : {};
		},
		write: (change) => void bridge.stage([change]),
		flush: () => void bridge.flush(),
	};
}

function readPath(stores: SettingsStores, store: string, key: string): SettingsValue | undefined {
	let result: SettingsValue | undefined = stores[store];

	if (!key) return result;

	for (const segment of key.split('.')) {
		if (!isSettingsObject(result)) return undefined;

		result = result[segment];
	}

	return result;
}

function writePath(stores: SettingsStores, store: string, key: string, value: SettingsValue) {
	const keys = key.split('.');
	const last = keys.pop() ?? key;
	let current = (stores[store] ??= {});

	for (const segment of keys) {
		const next = (current[segment] ??= {});

		if (!isSettingsObject(next)) {
			throw new TypeError(`Cannot set ${store}.${key}: ${segment} is not an object.`);
		}

		current = next;
	}

	current[last] = value;
}

function removePath(stores: SettingsStores, store: string, key: string): boolean {
	const keys = key.split('.');
	const last = keys.pop() ?? key;
	const parents: SettingsObject[] = [];
	let current: SettingsValue | undefined = stores[store];

	for (const segment of keys) {
		if (!isSettingsObject(current)) return false;

		parents.push(current);
		current = current[segment];
	}

	if (!isSettingsObject(current) || current[last] === undefined) return false;

	delete current[last];

	for (let index = keys.length - 1; index >= 0; index--) {
		const parent = parents[index];
		const segment = keys[index];

		if (!parent || segment === undefined) {
			break;
		}

		const child = parent[segment];

		if (!isSettingsObject(child) || !isEmpty(child)) {
			break;
		}

		delete parent[segment];
	}

	if (stores[store] && isEmpty(stores[store])) {
		delete stores[store];
	}

	return true;
}

/**
 * @description Keeps settings in a JS object and hands the changes to the loader on flush, for loaders without lazy native access.
 * @param stores The settings the loader injected.
 * @param getBridge Reads the loader's settings bridge when changes are flushed.
 * @returns The backend.
 */
export function createMemoryBackend(
	stores: SettingsStores,
	getBridge: () => NativePlatformSettings | undefined,
): SettingsBackend {
	const pending: NativeSettingsChange[] = [];

	return {
		read: (store, key) => readPath(stores, store, key),
		readAll: () => stores,
		write(change) {
			if ('clear' in change) {
				if (!stores[change.store]) return;

				delete stores[change.store];
			} else if ('remove' in change) {
				if (!removePath(stores, change.store, change.key)) return;
			} else {
				writePath(stores, change.store, change.key, change.value as SettingsValue);
			}

			pending.push(change);
		},
		flush() {
			const bridge = getBridge();

			if (!bridge || !pending.length) return;

			bridge.apply(pending.splice(0));
		},
	};
}

/**
 * @description Picks the native backend when the loader reads settings lazily, else the JS copy it injected.
 * @returns The backend.
 */
export function createSettingsBackend(): SettingsBackend {
	const bridge = globalThis.NativePlatform?.settings;

	if (hasLazyAccess(bridge)) return createNativeBackend(bridge);

	return createMemoryBackend(
		globalThis.UNBOUND_SETTINGS ?? {},
		() => globalThis.NativePlatform?.settings,
	);
}

export default createSettingsBackend;
