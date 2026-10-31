import { CORE_SETTINGS_STORE } from '@unbound-app/types/settings';
import type { PredicateResult, Widen } from '@unbound-app/types';

import type { SettingsPayload } from '~/api/storage';
import storage from '~/api/storage';

const NO_FONT_OVERRIDES: Record<string, string> = {};

/** Every key of the core `unbound` settings store with its default. The keys are persisted as-is. */
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
	'plugins.showLibraries': false,
	'updater.auto': true,
	'discord-support.warned': '',
	/** The font override map the loader applies, `{ [family]: overrideName }`. Treat it as read-only. */
	'font-states': NO_FONT_OVERRIDES,
};

/** The value type of every core setting. */
export type UnboundSettings = typeof DEFAULTS;

/** A key of the core `unbound` settings store. */
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
	return storage.get(CORE_SETTINGS_STORE, key, DEFAULTS[key]);
}

/**
 * @description Writes a core setting.
 * @template K The setting key.
 * @param key The setting key.
 * @param value The value to store.
 */
export function setSetting<K extends UnboundSettingKey>(key: K, value: UnboundSettings[K]): void {
	storage.set(CORE_SETTINGS_STORE, key, value);
}

/**
 * @description Flips a boolean core setting against its current value or default.
 * @param key The setting key.
 */
export function toggleSetting(key: BooleanSettingKey): void {
	storage.toggle(CORE_SETTINGS_STORE, key, DEFAULTS[key]);
}

/**
 * @description Whether a settings change is to a given core setting.
 * @param payload The change.
 * @param key The setting key.
 * @returns `true` when the change wrote that key of the core store.
 */
export function isSettingChange(payload: SettingsPayload, key: UnboundSettingKey): boolean {
	return payload.store === CORE_SETTINGS_STORE && payload.key === key;
}

/**
 * @description React hook that re-renders on matching changes to the core settings store.
 * @param predicate Optional filter deciding which changes trigger a re-render.
 * @returns The typed core setting accessors.
 */
export function useUnboundSettings(predicate?: (payload: SettingsPayload) => PredicateResult) {
	storage.useSettingsStore(CORE_SETTINGS_STORE, predicate);

	return { get: getSetting, set: setSetting, toggle: toggleSetting };
}

export default { getSetting, setSetting, toggleSetting, isSettingChange, useUnboundSettings };
