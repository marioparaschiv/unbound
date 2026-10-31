import type {
	FluxActionInterceptor,
	FluxActionListener,
	FluxChangeListener,
	FluxActionType,
	FluxStore,
} from '@unbound-app/types/flux';
import type { CommandsHandle } from '@unbound-app/types/commands';

import type { MetroLazySearchOptions, MetroModuleLoadListener } from '~/metro/types';
import type { Bucket, SettingsPayload } from '~/storage/api';
import type { Subscriptions } from '~/addons/subscriptions';
import type { MetroFilter } from '~/metro/filters';
import { createCommands } from '~/commands/api';
import type * as api from '~/core/api';

type Api = Omit<typeof api, 'default'>;

type Overlay<K extends keyof Api, O> = Omit<O, keyof Api[K]> & Api[K];

type ChangePredicate = Parameters<Bucket['addListener']>[0];

type ChangeCallback = (payload: SettingsPayload) => void;

export type ScopedCommands = {
	namespace: Overlay<'commands', CommandsHandle>;
	dispose: () => void;
};

function liveNamespace<K extends keyof Api>(key: K): Api[K] {
	const unbound: object = Reflect.get(globalThis, 'unbound');

	return Reflect.get(unbound, key);
}

function overlay<K extends keyof Api, O extends Partial<Api[K]>>(
	key: K,
	overrides: O,
): Overlay<K, O> {
	const view: object = {};

	return new Proxy(view, {
		get: (_target, prop) =>
			Object.hasOwn(overrides, prop)
				? Reflect.get(overrides, prop)
				: Reflect.get(liveNamespace(key), prop),
		has: (_target, prop) => Object.hasOwn(overrides, prop) || prop in liveNamespace(key),
	}) as Overlay<K, O>;
}

/**
 * @description Creates a plugin's `metro` namespace, whose module listeners and pending `findLazy` waits end on dispose.
 * @param subscriptions The plugin's subscription tracker.
 * @returns The namespace.
 */
export function scopeMetro(subscriptions: Subscriptions): Api['metro'] {
	function onModuleLoad(listener: MetroModuleLoadListener) {
		return subscriptions.add(liveNamespace('metro').onModuleLoad(listener), listener);
	}

	function removeListener(listener: MetroModuleLoadListener) {
		subscriptions.release(listener);
		liveNamespace('metro').removeListener(listener);
	}

	function findLazy(filter: MetroFilter, options: MetroLazySearchOptions = {}) {
		const controller = new AbortController();
		const { signal } = options;

		function abort() {
			controller.abort();
		}

		if (signal?.aborted) {
			abort();
		} else {
			signal?.addEventListener('abort', abort, { once: true });
		}

		const release = subscriptions.add(abort);
		const result = liveNamespace('metro').findLazy(filter, {
			...options,
			signal: controller.signal,
		});

		function settle() {
			signal?.removeEventListener('abort', abort);
			release();
		}

		if (result instanceof Promise) {
			void result.finally(settle);
		} else {
			settle();
		}

		return result;
	}

	return overlay('metro', {
		onModuleLoad,
		addListener: onModuleLoad,
		on: onModuleLoad,
		removeListener,
		off: removeListener,
		findLazy,
	});
}

/**
 * @description Creates a plugin's `storage` namespace: `getBucket()` with no name returns the plugin's own Bucket,
 * and every listener it adds is removed on dispose.
 * @param subscriptions The plugin's subscription tracker.
 * @param owner The plugin id, which names its own Bucket.
 * @returns The namespace.
 */
export function scopeStorage(subscriptions: Subscriptions, owner: string): Api['storage'] {
	function scopeBucket(bucket: Bucket): Bucket {
		return {
			...bucket,
			useSettingsStore: (predicate) => scopeBucket(bucket.useSettingsStore(predicate)),
			addListener: (predicate, callback) =>
				subscriptions.add(bucket.addListener(predicate, callback)),
		};
	}

	function getBucket(name: string = owner) {
		return scopeBucket(liveNamespace('storage').getBucket(name));
	}

	function useBucket(name: string, predicate?: ChangePredicate) {
		return scopeBucket(liveNamespace('storage').useBucket(name, predicate));
	}

	function onChange(predicate: ChangePredicate, callback: ChangeCallback) {
		return subscriptions.add(liveNamespace('storage').onChange(predicate, callback), callback);
	}

	function removeListener(callback: ChangeCallback) {
		subscriptions.release(callback);
		liveNamespace('storage').removeListener(callback);
	}

	function on(...args: Parameters<Api['storage']['on']>) {
		const [event, listener] = args;
		const emitter = liveNamespace('storage').on(...args);

		subscriptions.add(() => {
			if (emitter.listeners(event).includes(listener)) {
				emitter.off(...args);
			}
		});

		return emitter;
	}

	return overlay('storage', {
		getBucket,
		getStore: getBucket,
		useBucket,
		useSettingsStore: useBucket,
		onChange,
		addListener: onChange,
		removeListener,
		on,
	});
}

/**
 * @description Creates a plugin's `flux` namespace, whose store listeners, action listeners and interceptors are removed on dispose.
 * @param subscriptions The plugin's subscription tracker.
 * @returns The namespace.
 */
export function scopeFlux(subscriptions: Subscriptions): Api['flux'] {
	return overlay('flux', {
		onStoreChange(store: FluxStore, listener: FluxChangeListener) {
			return subscriptions.add(liveNamespace('flux').onStoreChange(store, listener));
		},
		onAction<K extends FluxActionType>(type: K, listener: FluxActionListener<K>) {
			return subscriptions.add(liveNamespace('flux').onAction(type, listener));
		},
		interceptAction<K extends FluxActionType>(type: K, interceptor: FluxActionInterceptor<K>) {
			return subscriptions.add(liveNamespace('flux').interceptAction(type, interceptor));
		},
	});
}

/**
 * @description Creates a plugin's `commands` namespace, which registers commands under the plugin's id.
 * @param owner The plugin id.
 * @returns The namespace, and a `dispose` that removes every command the plugin registered.
 */
export function scopeCommands(owner: string): ScopedCommands {
	const handle = createCommands(owner);

	return { namespace: overlay('commands', handle), dispose: () => handle.unregisterAll() };
}

export default { scopeMetro, scopeStorage, scopeFlux, scopeCommands };
