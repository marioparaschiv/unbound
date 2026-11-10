import type { SettingsValue } from '@unbound-app/types';

import type { Bucket } from '~/storage/api';

/** The per-addon maps a manager keeps in its Bucket. Sync reads them there, so they persist in settings. */
export type RecordKey = 'states' | 'consents' | 'held' | 'development' | 'sources' | 'applied';

/** Which record changed, and for which addon. */
export type RecordChange = {
	key: RecordKey;
	id: string;
};

/** One per-addon map a manager keeps, keyed by addon id. */
export type AddonRecord<V extends SettingsValue> = {
	/** Reads the whole map. */
	all: () => Record<string, V>;
	/** Reads one addon's value. */
	get: (id: string) => V | undefined;
	/** Writes one addon's value. Twin of `delete`. */
	set: (id: string, value: V) => void;
	/** Removes one addon's value. Twin of `set`. */
	delete: (id: string) => void;
};

/**
 * @description Creates a per-addon map stored under one Bucket key, calling `changed` after each write.
 * @template V The value kept per addon.
 * @param bucket The manager's Bucket.
 * @param key The key the map is stored under.
 * @param changed Runs after a write with the key and the addon id.
 * @returns The record.
 */
export function createRecord<V extends SettingsValue>(
	bucket: Bucket,
	key: Exclude<RecordKey, 'applied'>,
	changed: (change: RecordChange) => void,
): AddonRecord<V> {
	const all = (): Record<string, V> => bucket.get<Record<string, V>>(key, {});

	return {
		all,
		get: (id) => all()[id],
		set(id, value) {
			bucket.set(key, { ...all(), [id]: value });
			changed({ key, id });
		},
		delete(id) {
			const { [id]: removed, ...rest } = all();

			if (removed === undefined) return;

			bucket.set(key, rest);
			changed({ key, id });
		},
	};
}
