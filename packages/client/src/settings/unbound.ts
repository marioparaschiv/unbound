import type { PredicateResult, Widen } from '@unbound-app/types';
import { CORE_BUCKET } from '@unbound-app/types/settings';

import { DEFAULT_BACKGROUND_OPACITY, type ChatBackgroundSource } from '~/themes/chat-background';
import type { SettingsPayload } from '~/storage/api';
import { getBucket, useBucket } from '~/storage/api';

/** Every key of the core `unbound` Bucket with its default. The keys are persisted as-is. */
const DEFAULTS = {
	recovery: false,
	'developer-mode': false,
	'staff-mode': false,
	'crash-reports': false,
	'debugger.enabled': false,
	'debugger.address': '',
	'error-boundary.enabled': true,
	'toasts.enabled': true,
	'toasts.animations': true,
	'toasts.opacity': 0.8,
	'toasts.blur': 0.15,
	'toasts.duration': 5000,
	'toasts.maxOnScreen': 3,
	/** `theme` draws the applied theme's recommended chat background; `custom` draws `chat-background.url`. */
	'chat-background.source': 'theme' as ChatBackgroundSource,
	'chat-background.url': '',
	'chat-background.blur': 0,
	'chat-background.opacity': DEFAULT_BACKGROUND_OPACITY,
	'plugins.showLibraries': false,
	'marketplace.lastVisit': 0,
	/** The loader reads it at launch; off keeps the cached bundle until the user refetches. */
	'updater.auto.client': true,
	'updater.auto.addons': false,
	'updater.notify.client': true,
	'updater.notify.loader': true,
	'updater.notify.addons': true,
	/** The loader reads the `loader.*` keys at launch; an empty URL means the default bundle. */
	'loader.update.url': '',
	'loader.update.force': false,
	'loader.update.hmr': false,
	'loader.update.unsigned': false,
	'loader.devtools': false,
	'discord-support.warned': '',
};

/** The value type of every core setting. */
export type UnboundSettings = typeof DEFAULTS;

/** A key of the core `unbound` Bucket. */
export type UnboundSettingKey = keyof UnboundSettings;

/** A core setting key whose value is a boolean, so it can be toggled. */
export type BooleanSettingKey = {
	[K in UnboundSettingKey]: UnboundSettings[K] extends boolean ? K : never;
}[UnboundSettingKey];

/**
 * @description Reads a core setting, falling back to its default.
 * @template K The setting key.
 * @param key The setting key.
 * @returns The stored value, or the key's default.
 */
export function getSetting<K extends UnboundSettingKey>(key: K): Widen<UnboundSettings[K]> {
	return getBucket(CORE_BUCKET).get(key, DEFAULTS[key]);
}

/**
 * @description Reads a core setting's default, such as the value a reset restores.
 * @template K The setting key.
 * @param key The setting key.
 * @returns The key's default.
 */
export function getDefault<K extends UnboundSettingKey>(key: K): UnboundSettings[K] {
	return DEFAULTS[key];
}

/**
 * @description Writes a core setting.
 * @template K The setting key.
 * @param key The setting key.
 * @param value The value to store.
 */
export function setSetting<K extends UnboundSettingKey>(key: K, value: UnboundSettings[K]): void {
	getBucket(CORE_BUCKET).set(key, value);
}

/**
 * @description Flips a boolean core setting against its current value or default.
 * @param key The setting key.
 */
export function toggleSetting(key: BooleanSettingKey): void {
	getBucket(CORE_BUCKET).toggle(key, DEFAULTS[key]);
}

/**
 * @description Whether a settings change is to a given core setting.
 * @param payload The change.
 * @param key The setting key.
 * @returns `true` when the change wrote that key of the core store.
 */
export function isSettingChange(payload: SettingsPayload, key: UnboundSettingKey): boolean {
	return payload.store === CORE_BUCKET && payload.key === key;
}

/**
 * @description React hook that re-renders on matching changes to the core Bucket.
 * @param predicate Optional filter deciding which changes trigger a re-render.
 * @returns The typed core setting accessors.
 */
export function useUnboundSettings(predicate?: (payload: SettingsPayload) => PredicateResult) {
	useBucket(CORE_BUCKET, predicate);

	return { get: getSetting, set: setSetting, toggle: toggleSetting };
}
