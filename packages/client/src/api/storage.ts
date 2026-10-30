import type {
	NativeSettingsChange,
	PredicateResult,
	SettingsObject,
	SettingsValue,
	Widen,
} from '@unbound-app/types';
import debounce from '@unbound-app/utils/debounce';
import isEmpty from '@unbound-app/utils/is-empty';
import { useEffect, useState } from 'react';

import { EventEmitter } from '~/lib/event-emitter';

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

type EventMap = {
	set: (payload: SetPayload) => void;
	changed: (payload: SettingsPayload) => void;
	cleared: (payload: ClearedPayload) => void;
	removed: (payload: RemovedPayload) => void;
	toggled: (payload: ToggledPayload) => void;
};

const Events = new EventEmitter<EventMap>();
const handlers = new Map<(payload: SettingsPayload) => void, (payload: SettingsPayload) => void>();

/** @internal */
export const settings: Record<string, SettingsObject> = globalThis.UNBOUND_SETTINGS ?? {};

export const on = Events.on.bind(Events);
export const off = Events.off.bind(Events);

/**
 * @description Registers a callback invoked on every settings change matching the predicate.
 * @param predicate Decides whether a given change should fire the callback.
 * @param callback Invoked with the payload of each matching change.
 * @returns A function that removes the listener.
 */
export function addListener(
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

/**
 * @description Removes a previously registered settings change listener.
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
 * @template T The type of the default value.
 * @param store The store to read from.
 * @param key The dot-separated key path within the store.
 * @param def The value to return when the key is not set.
 * @returns The stored value, or `def` if the key path is not present.
 */
export function get<T>(store: string, key: string, def: T): Widen<T> {
	let result: SettingsValue | undefined = settings[store];

	for (const segment of key.split('.')) {
		const next = isSettingsObject(result) ? result[segment] : void 0;

		if (next === void 0) {
			return def as Widen<T>;
		}

		result = next;
	}

	return result as Widen<T>;
}

function isSettingsObject(value: SettingsValue | undefined): value is SettingsObject {
	return typeof value === 'object' && value !== null;
}

/**
 * @description Writes a value into a store at a dot-separated key path, creating intermediate objects, and emits `changed` and `set`.
 * @param store The store to write to.
 * @param key The dot-separated key path within the store.
 * @param value The value to store.
 */
export function set(store: string, key: string, value: SettingsValue) {
	const keys = key.split('.');
	const last = keys.pop() ?? key;
	let current = (settings[store] ??= {});

	for (const segment of keys) {
		const next = (current[segment] ??= {});

		if (!isSettingsObject(next)) {
			throw new TypeError(`Cannot set ${store}.${key}: ${segment} is not an object.`);
		}

		current = next;
	}

	current[last] = value;

	Events.emit('changed', { store, key, value });
	Events.emit('set', { store, key, value });
}

/**
 * @description Flips a boolean value at a key path against its current (or default) value, and emits `toggled`.
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
 * @param store The store to remove the key from.
 * @param key The dot-separated key path to delete.
 */
export function remove(store: string, key: string) {
	const keys = key.split('.');
	const last = keys.pop() ?? key;
	const parents: SettingsObject[] = [];
	let current: SettingsValue | undefined = settings[store];

	for (const segment of keys) {
		if (!isSettingsObject(current)) return;

		parents.push(current);
		current = current[segment];
	}

	if (!isSettingsObject(current) || current[last] === undefined) return;

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

	if (settings[store] && isEmpty(settings[store])) {
		delete settings[store];
	}

	Events.emit('changed', { store, key, value: undefined });
	Events.emit('removed', { store, key });
}

/**
 * @description Removes an entire store and all of its keys, and emits `changed` and `cleared`.
 * @param store The store to clear.
 */
export function clear(store: string) {
	if (!settings[store]) return;

	delete settings[store];

	Events.emit('changed', { store, key: null, value: undefined });
	Events.emit('cleared', { store });
}

function bindStore(store: string) {
	return {
		set: (key: string, value: SettingsValue) => set(store, key, value),
		get: <T>(key: string, def: T): Widen<T> => get(store, key, def),
		toggle: (key: string, def: boolean) => toggle(store, key, def),
		remove: (key: string) => remove(store, key),
	};
}

/**
 * @description Builds a store-scoped facade binding every settings operation to a single store name.
 * @param store The store name to scope every operation to.
 * @returns An object exposing `get`, `set`, `toggle`, `remove`, `clear`, `useSettingsStore`, and `addListener` bound to the store.
 */
export function getStore(store: string) {
	return {
		...bindStore(store),
		clear: () => clear(store),
		useSettingsStore: (predicate?: (payload: SettingsPayload) => PredicateResult) =>
			useSettingsStore(store, predicate),
		addListener: (
			predicate: (payload: SettingsPayload) => PredicateResult,
			callback: (payload: SettingsPayload) => void,
		) => {
			function handler(payload: SettingsPayload) {
				if (payload.store !== store) return;

				if (predicate(payload)) {
					callback(payload);
				}
			}

			Events.on('changed', handler);

			return () => Events.off('changed', handler);
		},
	};
}

/**
 * @description React hook that re-renders the component whenever a matching change occurs in the store.
 * @param store The store to subscribe to.
 * @param predicate Optional filter deciding which changes trigger a re-render.
 * @returns An object exposing `get`, `set`, `toggle`, and `remove` bound to the store.
 */
export function useSettingsStore(
	store: string,
	predicate?: (payload: SettingsPayload) => PredicateResult,
) {
	const [, forceUpdate] = useState({});

	useEffect(() => {
		function handler(payload: SettingsPayload) {
			if (payload.store !== store) return;

			if (!predicate || predicate(payload)) {
				forceUpdate({});
			}
		}

		Events.on('changed', handler);

		return () => void Events.off('changed', handler);
	}, []);

	return bindStore(store);
}

const pending: NativeSettingsChange[] = [];

function record({ store, key, value }: SettingsPayload) {
	if (key === null) {
		pending.push({ store, clear: true });
	} else if (value === undefined) {
		pending.push({ store, key, remove: true });
	} else {
		pending.push({ store, key, value });
	}
}

/**
 * @description Hands the settings changed since the last call to the loader, which merges them into the
 * settings file key by key, so values the loader wrote in the meantime are kept.
 * @returns A promise that resolves once the loader has stored the changes.
 */
export async function persist() {
	const settingsBridge = globalThis.NativePlatform?.settings;

	if (!settingsBridge || !pending.length) return;

	settingsBridge.apply(pending.splice(0));
}

Events.on('changed', record);
Events.on(
	'changed',
	debounce(() => void persist(), 100),
);

export default {
	addListener,
	get,
	getStore,
	off,
	on,
	persist,
	remove,
	removeListener,
	set,
	toggle,
	useSettingsStore,
};
