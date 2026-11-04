import { useEffect, useState } from 'react';

import type { ListenerRegistry } from './listener-registry';
import type { FluxAction, FluxStore } from '../src/flux';
import type { FakeModule } from './fake-metro';

/** A seeded store's methods and fields, whatever the test gives it, such as `getCurrentUser`. */
type StoreSeed = FakeModule;

/** The Flux stores to seed, by name with or without `Store`, such as `{ User: { getCurrentUser: () => user } }`. */
export type StoreSeeds = Record<string, StoreSeed>;

/** The fake `flux`: stores the test seeds, and a dispatcher that records each action. */
export type FakeFlux = {
	/** Every action `dispatch` sent, in order. */
	dispatched: FluxAction[];
	/** Adds stores, or replaces a seeded store's methods and emits its change; `getStore` reads them on each access. */
	seed: (stores: StoreSeeds) => void;
	/** Calls a seeded store's change listeners, re-rendering each `useStore` reading it. */
	emit: (name: string) => void;
	getStore: (name: string) => FluxStore & StoreSeed;
	/** Reads `selector(stores)` on each render, and re-renders when a store emits; `deps` and `isEqual` change nothing a test sees. */
	useStore: <S extends FluxStore | readonly FluxStore[], T>(
		stores: S,
		selector: (stores: S) => T,
	) => T;
	onStoreChange: (store: FluxStore, listener: () => void) => () => void;
	onAction: (type: string, listener: (action: FluxAction) => void) => () => void;
	interceptAction: (
		type: string,
		interceptor: (action: FluxAction) => boolean | void,
	) => () => void;
	dispatch: (action: FluxAction) => Promise<void>;
	reset: () => void;
};

/** The fake `assets`: every name has a stable id, so an image import equals `assets.getIdByName(name)`. */
export type FakeAssets = {
	getIdByName: (name: string, type?: AssetType) => number;
	getByName: (name: string, type?: AssetType) => FakeAsset;
	register: (options: AssetRegistration) => RegisteredAsset;
	onAssetRegistered: (listener: AssetListener) => () => void;
};

/** The type an asset is asked for by. */
export type AssetType = 'svg' | 'png';

/** An asset `getByName` returns. */
export type FakeAsset = { id: number; name: string; type: string };

/** What `register` takes: the asset's name, and its type. */
export type AssetRegistration = { name: string; type?: string };

/** What `register` returns: the asset's id, and how to take it out again. */
export type RegisteredAsset = { id: number; unregister: () => void };

/** Called with each asset registered, and its id. */
export type AssetListener = (asset: AssetRegistration, id: number) => void;

/**
 * @description Gives an asset name a stable fake id, the same in every run.
 * @param name The asset's name, such as `icon` for `assets/icon.png`.
 * @param type The type it was asked for; an SVG's `?asset` raster asks for `png`.
 * @returns A positive id.
 */
export function fakeAssetId(name: string, type: string = ''): number {
	let hash = 0x811c9dc5;

	for (const char of `${type}:${name}`) {
		hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193);
	}

	return 1000 + ((hash >>> 0) % 1_000_000);
}

function shortName(name: string): string {
	return name.endsWith('Store') ? name.slice(0, -'Store'.length) : name;
}

/**
 * @description Creates the fake `flux`, whose listeners go through `listeners` so `stopPlugin` sees any left behind.
 * @param listeners The registry the plugin's listeners are tracked in.
 * @returns The flux.
 */
export function createFakeFlux(listeners: ListenerRegistry): FakeFlux {
	const stores = new Map<string, FluxStore & StoreSeed>();
	const actionListeners = new Map<string, Set<(action: FluxAction) => void>>();
	const interceptors = new Map<string, Set<(action: FluxAction) => boolean | void>>();
	const dispatched: FluxAction[] = [];

	function storeOf(name: string, seed: StoreSeed): FluxStore & StoreSeed {
		const changeListeners = new Set<() => void>();

		return {
			getName: () => `${name}Store`,
			addChangeListener: (listener) => void changeListeners.add(listener),
			removeChangeListener: (listener) => void changeListeners.delete(listener),
			emitChange: () => {
				for (const listener of changeListeners) listener();
			},
			...seed,
		};
	}

	function seeded(name: string) {
		const store = stores.get(shortName(name));

		if (!store) {
			throw new Error(
				`Failed to read Flux store ${name}: seed it with render(..., { stores: { ${shortName(name)}: {...} } }).`,
			);
		}

		return store;
	}

	function subscribe<T>(map: Map<string, Set<T>>, type: string, listener: T, label: string) {
		const set = map.get(type) ?? new Set<T>();

		map.set(type, set);
		set.add(listener);

		return listeners.track(label, () => void set.delete(listener));
	}

	return {
		dispatched,
		seed(next) {
			for (const [name, seed] of Object.entries(next)) {
				const existing = stores.get(shortName(name));

				// The same object keeps its change listeners, so a `useStore` reading it re-renders.
				if (existing) {
					Object.assign(existing, seed);
					existing.emitChange();
				} else {
					stores.set(shortName(name), storeOf(shortName(name), seed));
				}
			}
		},
		emit: (name) => seeded(name).emitChange(),
		// Lazy, as on device: a store read at import resolves on first property access.
		getStore: (name) =>
			new Proxy<FluxStore & StoreSeed>(storeOf(shortName(name), {}), {
				get: (_target, key) => Reflect.get(seeded(name), key),
				has: (_target, key) => key in seeded(name),
			}),
		useStore(watched, selector) {
			const [, forceUpdate] = useState({});
			const list = [watched].flat();

			useEffect(() => {
				const update = () => forceUpdate({});

				for (const store of list) store.addChangeListener(update);

				return () => {
					for (const store of list) store.removeChangeListener(update);
				};
			}, list);

			return selector(watched);
		},
		onStoreChange(store, listener) {
			store.addChangeListener(listener);

			return listeners.track(`flux.onStoreChange(${store.getName()})`, () =>
				store.removeChangeListener(listener),
			);
		},
		onAction: (type, listener) =>
			subscribe(actionListeners, type, listener, `flux.onAction(${type})`),
		interceptAction: (type, interceptor) =>
			subscribe(interceptors, type, interceptor, `flux.interceptAction(${type})`),
		async dispatch(action) {
			dispatched.push(action);

			for (const interceptor of interceptors.get(action.type) ?? []) {
				if (interceptor(action) === true) return;
			}

			for (const listener of actionListeners.get(action.type) ?? []) listener(action);
		},
		reset() {
			stores.clear();
			actionListeners.clear();
			interceptors.clear();
			dispatched.length = 0;
		},
	};
}

/**
 * @description Creates the fake `assets`.
 * @param listeners The registry registrations and listeners are tracked in.
 * @returns The assets.
 */
export function createFakeAssets(listeners: ListenerRegistry): FakeAssets {
	const registered = new Set<AssetListener>();

	return {
		getIdByName: (name, type) => fakeAssetId(name, type),
		getByName: (name, type) => ({ id: fakeAssetId(name, type), name, type: type ?? 'png' }),
		register(options) {
			const id = fakeAssetId(options.name, options.type);

			for (const listener of registered) listener(options, id);

			return {
				id,
				unregister: listeners.track(`assets.register(${options.name})`, () => {}),
			};
		},
		onAssetRegistered(listener) {
			registered.add(listener);

			return listeners.track(
				'assets.onAssetRegistered',
				() => void registered.delete(listener),
			);
		},
	};
}
