import { CORE_SETTINGS_STORE } from '@unbound-app/types/settings';

import type { SyncDocument } from './sync';

/** The addon managers whose installs sync, named after their settings buckets. */
export const SYNC_KINDS = ['plugins', 'themes', 'icons', 'fonts'] as const;

/** The core settings store; addon settings stores are named after the addon id. */
export const SYNC_CORE_STORE = CORE_SETTINGS_STORE;

/** Stores under this prefix hold caches and session state, and never sync. */
export const SYNC_LOCAL_STORE_PREFIX = 'unbound::';

/** Keys of the core store that only make sense on the device that set them. */
export const SYNC_LOCAL_KEYS = ['recovery', 'debugger', 'loader'] as const;

/** The built-in icon pack, which is always installed and may be applied without a synced install. */
export const SYNC_DEFAULT_ICON_PACK = 'default';

export const SYNC_ID_PATTERN = /^[\w.-]{1,128}$/;

/**
 * @description Builds a document with no installs and no settings.
 * @returns The empty document.
 */
export function emptySyncDocument(): SyncDocument {
	const kind = () => ({ installs: [], applied: null });

	return {
		addons: { plugins: kind(), themes: kind(), icons: kind(), fonts: kind() },
		settings: {},
	};
}

export default {
	SYNC_KINDS,
	SYNC_CORE_STORE,
	SYNC_LOCAL_STORE_PREFIX,
	SYNC_LOCAL_KEYS,
	SYNC_DEFAULT_ICON_PACK,
	SYNC_ID_PATTERN,
	emptySyncDocument,
};
