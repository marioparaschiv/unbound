import type { PredicateResult, SettingsObject, SettingsValue, Widen } from '@unbound-app/types';
import debounce from '@unbound-app/utils/debounce';
import { useEffect, useState } from 'react';

import { EventEmitter } from '~/core/event-emitter';
import { createSettingsBackend, type SettingsStores } from '~/storage/backend';

/** Payload describing a settings change, passed to `changed` listeners and predicates. */
export type SettingsPayload = {
	store: string;
	key: string | null;
	value: SettingsValue | undefined;
};

type SetPayload = { store: string; key: string; value: SettingsValue };
type ClearedPayload = { store: string };
type RemovedPayload = { store: string; key: string };
type ToggledPayload = { store: string; key: string; prev: boolean; value: boolean };

/** A Bucket: a named, persisted group of settings. Keys are dot-separated paths. */
export type Bucket = {
	/** Reads a value, falling back to `def` when the key is not set. */
	get: <T>(key: string, def: T) => Widen<T>;
	/** Writes a value, creating intermediate objects. */
	set: (key: string, value: SettingsValue) => void;
	/** Flips a boolean against its current value, or `def` when the key is not set. */
	toggle: (key: string, def: boolean) => void;
	/** Deletes a value and prunes the objects it leaves empty. */
	remove: (key: string) => void;
	/** Deletes every setting in the Bucket. */
	clear: () => void;
	/** @deprecated Use storage.useBucket(name) */
	useSettingsStore: (predicate?: (payload: SettingsPayload) => PredicateResult) => Bucket;
	/** @deprecated Use storage.onChange */
	addListener: (
		predicate: (payload: SettingsPayload) => PredicateResult,
		callback: (payload: SettingsPayload) => void,
	) => () => void;
};

type EventMap = {
	set: (payload: SetPayload) => void;
	changed: (payload: SettingsPayload) => void;
	cleared: (payload: ClearedPayload) => void;
	removed: (payload: RemovedPayload) => void;
	toggled: (payload: ToggledPayload) => void;
};

const Events = new EventEmitter<EventMap>();
const handlers = new Map<(payload: SettingsPayload) => void, (payload: SettingsPayload) => void>();

const backend = createSettingsBackend();

/**
 * @description Reads every Bucket at once. Most callers should read single keys, which stay in native code.
 * @returns Every Bucket by name.
 */
export function snapshot(): SettingsStores {
	return backend.readAll();
}

/** @deprecated Use onChange */
export const on = Events.on.bind(Events);
/** @deprecated Use the function onChange returns */
export const off = Events.off.bind(Events);

/**
 * @description Registers a callback invoked on every settings change matching the predicate.
 * @param predicate Decides whether a given change should fire the callback. The payload names the Bucket in `store`.
 * @param callback Invoked with the payload of each matching change.
 * @returns A function that removes the listener.
 */
export function onChange(
	predicate: (payload: SettingsPayload) => PredicateResult,
	callback: (payload: SettingsPayload) => void,
) {
	function handler(payload: SettingsPayload) {
		if (predicate(payload)) {
			callback(payload);
		}
	}

	handlers.set(callback, handler);
	Events.on('changed', handler);

	return () => removeListener(callback);
}

/** @deprecated Use onChange */
export const addListener = onChange;

/**
 * @description Removes a previously registered settings change listener.
 * @deprecated Call the function onChange returns.
 * @param callback The listener to remove.
 */
export function removeListener(callback: (payload: SettingsPayload) => void) {
	const handler = handlers.get(callback);

	if (!handler) return;

	handlers.delete(callback);
	Events.off('changed', handler);
}

/**
 * @description Reads a value from a store by dot-separated key path, falling back to a default when absent.
 * @deprecated Use getBucket(store).get
 * @template T The type of the default value.
 * @param store The store to read from.
 * @param key The dot-separated key path within the store.
 * @param def The value to return when the key is not set.
 * @returns The stored value, or `def` if the key path is not present.
 */
export function get<T>(store: string, key: string, def: T): Widen<T> {
	const value = backend.read(store, key);

	return (value === undefined ? def : value) as Widen<T>;
}

/**
 * @description Writes a value into a store at a dot-separated key path, creating intermediate objects, and emits `changed` and `set`.
 * @deprecated Use getBucket(store).set
 * @param store The store to write to.
 * @param key The dot-separated key path within the store.
 * @param value The value to store.
 */
export function set(store: string, key: string, value: SettingsValue) {
	backend.write({ store, key, value });

	Events.emit('changed', { store, key, value });
	Events.emit('set', { store, key, value });
}

/**
 * @description Flips a boolean value at a key path against its current (or default) value, and emits `toggled`.
 * @deprecated Use getBucket(store).toggle
 * @param store The store to write to.
 * @param key The dot-separated key path within the store.
 * @param def The value to assume when the key is not yet set.
 */
export function toggle(store: string, key: string, def: boolean) {
	const prev = get(store, key, def);

	set(store, key, !prev);

	Events.emit('toggled', { store, key, prev, value: !prev });
}

/**
 * @description Deletes a value at a dot-separated key path, pruning objects the deletion leaves empty and the store itself when it becomes empty, and emits `changed` and `removed`.
 * @deprecated Use getBucket(store).remove
 * @param store The store to remove the key from.
 * @param key The dot-separated key path to delete.
 */
export function remove(store: string, key: string) {
	if (backend.read(store, key) === undefined) return;

	backend.write({ store, key, remove: true });

	Events.emit('changed', { store, key, value: undefined });
	Events.emit('removed', { store, key });
}

/**
 * @description Removes an entire store and all of its keys, and emits `changed` and `cleared`.
 * @deprecated Use getBucket(store).clear
 * @param store The store to clear.
 */
export function clear(store: string) {
	if (backend.read(store, '') === undefined) return;

	backend.write({ store, clear: true });

	Events.emit('changed', { store, key: null, value: undefined });
	Events.emit('cleared', { store });
}

/**
 * @description Returns the Bucket with the given name. The name is the key the Bucket is saved under on disk.
 * @param name The Bucket name. A plugin may omit it to get its own Bucket, named after its id.
 * @returns The Bucket, with every operation bound to `name`.
 * @throws When `name` is omitted outside a plugin.
 */
export function getBucket(name?: string): Bucket {
	if (name === undefined) {
		throw new Error('getBucket needs a Bucket name outside a plugin.');
	}

	return {
		get: <T>(key: string, def: T): Widen<T> => get(name, key, def),
		set: (key, value) => set(name, key, value),
		toggle: (key, def) => toggle(name, key, def),
		remove: (key) => remove(name, key),
		clear: () => clear(name),
		useSettingsStore: (predicate) => useBucket(name, predicate),
		addListener: (predicate, callback) => {
			function handler(payload: SettingsPayload) {
				if (payload.store !== name) return;

				if (predicate(payload)) {
					callback(payload);
				}
			}

			Events.on('changed', handler);

			return () => void Events.off('changed', handler);
		},
	};
}

/** @deprecated Use getBucket */
export const getStore = getBucket;

/**
 * @description React hook that re-renders the component whenever a matching change occurs in the Bucket.
 * @param name The Bucket to subscribe to.
 * @param predicate Optional filter deciding which changes trigger a re-render.
 * @returns The Bucket, with every operation bound to `name`.
 */
export function useBucket(
	name: string,
	predicate?: (payload: SettingsPayload) => PredicateResult,
): Bucket {
	const [, forceUpdate] = useState({});

	useEffect(() => {
		function handler(payload: SettingsPayload) {
			if (payload.store !== name) return;

			if (!predicate || predicate(payload)) {
				forceUpdate({});
			}
		}

		Events.on('changed', handler);

		return () => void Events.off('changed', handler);
	}, []);

	return getBucket(name);
}

/** @deprecated Use useBucket */
export const useSettingsStore = useBucket;

/**
 * @description Saves the settings changed since the last call. Each change already reached the loader when it was made.
 * @returns A promise that resolves once the loader has saved them.
 */
export async function persist() {
	backend.flush();
}

Events.on(
	'changed',
	debounce(() => void persist(), 100),
);

export default {
	addListener,
	clear,
	get,
	getBucket,
	getStore,
	off,
	on,
	onChange,
	persist,
	snapshot,
	remove,
	removeListener,
	set,
	toggle,
	useBucket,
	useSettingsStore,
};
