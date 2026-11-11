import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PredicateResult, SettingsValue, Widen } from '@unbound-app/types';
import { settingEntries } from '@unbound-app/contracts/settings-schema';
import type { SettingsSchema } from '@unbound-app/types/settings';
import debounce from '@unbound-app/utils/debounce';

import { createSettingsBackend, type SettingsByBucket } from '~/storage/backend';
import { createDefinedSettings, type DefinedSettings } from '~/storage/define';
import { maskSecrets, registerSecrets } from '~/storage/secrets';
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

/** The last `useSetting` snapshot, and the Bucket revision and selector it was taken with. */
type Selection<T> = {
	name: string;
	revision: number;
	selector: (bucket: Bucket) => T;
	value: T;
};

// Counts each Bucket's changes, so a `useSetting` snapshot stays the same object until its Bucket changes.
const revisions = new Map<string, number>();

/**
 * @description Reads every Bucket at once. Most callers should read single keys, which stay in native code.
 * @param options Set `includeSecrets` to read `displayAs: 'secret'` settings as they are; otherwise they are masked.
 * @returns Every Bucket by name.
 */
export function snapshot({
	includeSecrets = false,
}: { includeSecrets?: boolean } = {}): SettingsByBucket {
	const stores = backend.readAll();

	return includeSecrets ? stores : maskSecrets(stores);
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

function changed(payload: SettingsPayload) {
	revisions.set(payload.store, (revisions.get(payload.store) ?? 0) + 1);

	Events.emit('changed', payload);
}

function read<T>(store: string, key: string, def: T): Widen<T> {
	const value = backend.read(store, key);

	return (value === undefined ? def : value) as Widen<T>;
}

function write(store: string, key: string, value: SettingsValue) {
	backend.write({ store, key, value });

	changed({ store, key, value });
}

function remove(store: string, key: string) {
	if (backend.read(store, key) === undefined) return;

	backend.write({ store, key, remove: true });

	changed({ store, key, value: undefined });
}

function clear(store: string) {
	if (backend.read(store, '') === undefined) return;

	backend.write({ store, clear: true });

	changed({ store, key: null, value: undefined });
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
 * @description Binds a settings schema to a Bucket: reads apply defaults and writes are validated against the schema.
 * Plugins reach it through `@unbound-app/settings`, which the build generates from their settings.ts.
 * @param schema The settings schema.
 * @param name The Bucket name. A plugin may omit it to use its own Bucket.
 * @returns The settings, their hook and their reset.
 * @throws When `name` is omitted outside a plugin.
 */
export function define(schema: SettingsSchema, name?: string): DefinedSettings {
	if (name === undefined) {
		throw new Error('define needs a Bucket name outside a plugin.');
	}

	registerSecrets(
		name,
		settingEntries(schema).flatMap(({ path, field }) =>
			field.kind === 'string' && field.displayAs === 'secret' ? [path] : [],
		),
	);

	return createDefinedSettings(schema, getBucket(name), (callback) =>
		onChange((payload) => payload.store === name, callback),
	);
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
 * @description React hook that selects from a Bucket, re-rendering only when the selection changes.
 * @template T The value the selector returns.
 * @param name The Bucket to read.
 * @param selector Reads the value from the Bucket.
 * @param isEqual Decides whether a new selection equals the last one, which skips the re-render. Defaults to `Object.is`.
 * @returns The selector's latest value.
 */
export function useSetting<T>(
	name: string,
	selector: (bucket: Bucket) => T,
	isEqual: (previous: T, next: T) => boolean = Object.is,
): T {
	const selected = useRef<Selection<T>>(undefined);
	const subscribe = useCallback(
		(notify: () => void) => onChange(({ store }) => store === name, notify),
		[name],
	);

	// useSyncExternalStore re-renders when the snapshot's identity changes, so the snapshot is reused until the
	// Bucket or selector changes, and an equal selection keeps the previous one.
	function getSnapshot() {
		const previous = selected.current;
		const revision = revisions.get(name) ?? 0;

		if (
			previous?.name === name &&
			previous.revision === revision &&
			previous.selector === selector
		) {
			return previous.value;
		}

		const next = selector(getBucket(name));
		const value = previous && isEqual(previous.value, next) ? previous.value : next;

		selected.current = { name, revision, selector, value };

		return value;
	}

	return useSyncExternalStore(subscribe, getSnapshot);
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
	define,
	getBucket,
	onChange,
	persist,
	snapshot,
	useBucket,
	useSetting,
};
