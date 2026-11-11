import type { SettingsObject } from '@unbound-app/types/settings';

import type { SettingsStores } from '~/storage/backend';

/** What a secret setting reads as in a masked snapshot. */
const MASKED_SECRET = '[secret]';

// Each Bucket's secret settings, by dot-separated key: the `displayAs: 'secret'` settings of a defined schema.
const secrets = new Map<string, Set<string>>();

/**
 * @description Marks settings of a Bucket as secret, so a snapshot masks them.
 * @param store The Bucket name.
 * @param keys The secret settings' dot-separated keys.
 */
export function registerSecrets(store: string, keys: string[]) {
	if (keys.length) {
		secrets.set(store, new Set(keys));
	}
}

function masked(store: SettingsObject, keys: Set<string>): SettingsObject {
	const copy: SettingsObject = { ...store };

	for (const key of keys) {
		const parts = key.split('.');
		const last = parts.pop() ?? key;
		let parent: SettingsObject = copy;

		for (const part of parts) {
			const child = parent[part];

			if (typeof child !== 'object' || child === null || Array.isArray(child)) {
				break;
			}

			parent = parent[part] = { ...child };
		}

		if (last in parent) {
			parent[last] = MASKED_SECRET;
		}
	}

	return copy;
}

/**
 * @description Masks the secret settings of every Bucket, copying only when a Bucket holds one.
 * @param stores Every Bucket by name.
 * @returns The masked copy, or the stores themselves when none holds a secret.
 */
export function maskSecrets(stores: SettingsStores): SettingsStores {
	// With no secret held anywhere, the live stores are returned as they are, as `snapshot` always did.
	if (![...secrets.keys()].some((store) => stores[store])) {
		return stores;
	}

	const copy: SettingsStores = { ...stores };

	for (const [store, keys] of secrets) {
		const data = copy[store];

		if (data) {
			copy[store] = masked(data, keys);
		}
	}

	return copy;
}

export default { MASKED_SECRET, maskSecrets, registerSecrets };
