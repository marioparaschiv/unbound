import type { PredicateResult, SettingsValue, Widen } from '@unbound-app/types';
import debounce from '@unbound-app/utils/debounce';
import { useEffect, useState } from 'react';

import { createSettingsBackend, type SettingsStores } from '~/storage/backend';
import { EventEmitter } from '~/core/event-emitter';

/** Payload describing a settings change, passed to `onChange` listeners and predicates. */
export type SettingsPayload = {
	/** The name of the Bucket that changed. */
	store: string;
	/** The dot-separated key that changed, or `null` when the whole Bucket was cleared. */
	key: string | null;
	/** The new value, or `undefined` when the key was removed or the Bucket cleared. */
	value: SettingsValue | undefined;
};

/** Decides whether a settings change should reach a listener. */
export type SettingsPredicate = (payload: SettingsPayload) => PredicateResult;

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
};

type EventMap = {
	changed: (payload: SettingsPayload) => void;
};

const Events = new EventEmitter<EventMap>();

const backend = createSettingsBackend();

/**
 * @description Reads every Bucket at once. Most callers should read single keys, which stay in native code.
 * @returns Every Bucket by name.
 */
export function snapshot(): SettingsStores {
	return backend.readAll();
}

/**
 * @description Registers a callback invoked on every settings change matching the predicate.
 * @param predicate Decides whether a given change should fire the callback. The payload names the Bucket in `store`.
 * @param callback Invoked with the payload of each matching change.
 * @returns A function that removes the listener.
 */
export function onChange(
	predicate: SettingsPredicate,
	callback: (payload: SettingsPayload) => void,
): () => void {
	function handler(payload: SettingsPayload) {
		if (predicate(payload)) {
			callback(payload);
		}
	}

	Events.on('changed', handler);

	return () => void Events.off('changed', handler);
}

function read<T>(store: string, key: string, def: T): Widen<T> {
	const value = backend.read(store, key);

	return (value === undefined ? def : value) as Widen<T>;
}

function write(store: string, key: string, value: SettingsValue) {
	backend.write({ store, key, value });

	Events.emit('changed', { store, key, value });
}

function remove(store: string, key: string) {
	if (backend.read(store, key) === undefined) return;

	backend.write({ store, key, remove: true });

	Events.emit('changed', { store, key, value: undefined });
}

function clear(store: string) {
	if (backend.read(store, '') === undefined) return;

	backend.write({ store, clear: true });

	Events.emit('changed', { store, key: null, value: undefined });
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
		get: <T>(key: string, def: T): Widen<T> => read(name, key, def),
		set: (key, value) => write(name, key, value),
		toggle: (key, def) => write(name, key, !read(name, key, def)),
		remove: (key) => remove(name, key),
		clear: () => clear(name),
	};
}

/**
 * @description React hook that re-renders the component whenever a matching change occurs in the Bucket.
 * @param name The Bucket to subscribe to.
 * @param predicate Optional filter deciding which changes trigger a re-render.
 * @returns The Bucket, with every operation bound to `name`.
 */
export function useBucket(name: string, predicate?: SettingsPredicate): Bucket {
	const [, forceUpdate] = useState({});

	useEffect(
		() =>
			onChange(
				(payload) => payload.store === name && (!predicate || predicate(payload)),
				() => forceUpdate({}),
			),
		[],
	);

	return getBucket(name);
}

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
	getBucket,
	onChange,
	persist,
	snapshot,
	useBucket,
};
