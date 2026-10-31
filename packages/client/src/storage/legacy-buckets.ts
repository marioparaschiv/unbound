import type { SettingsObject, SettingsValue } from '@unbound-app/types';
import { CORE_SETTINGS_STORE } from '@unbound-app/types/settings';

import { clear, get, set, settings } from '~/storage/api';

/** The name Unbound briefly shipped under: its core Bucket and the first-party plugin ids and their Buckets. */
const LEGACY_NAME = 'astral';
const LEGACY_PREFIX = `${LEGACY_NAME}.`;

/** The Buckets of the managers whose `states` map is keyed by addon id. */
const ADDON_STATE_BUCKETS = ['plugins'];

function isSettingsObject(value: SettingsValue | undefined): value is SettingsObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function renamedId(id: string): string | undefined {
	if (id === LEGACY_NAME) {
		return CORE_SETTINGS_STORE;
	}

	if (id.startsWith(LEGACY_PREFIX)) {
		return `unbound.${id.slice(LEGACY_PREFIX.length)}`;
	}

	return undefined;
}

/**
 * @description Fills what `current` lacks from `legacy`, recursing into objects both hold; a value `current` already has wins.
 * @param current The value under the new name, if any.
 * @param legacy The value under the legacy name.
 * @returns `current` itself when `legacy` adds nothing, otherwise the merged value.
 */
function fillMissing(current: SettingsValue | undefined, legacy: SettingsValue): SettingsValue {
	if (current === undefined) {
		return legacy;
	}

	if (!isSettingsObject(current) || !isSettingsObject(legacy)) {
		return current;
	}

	let merged: SettingsObject | undefined;

	for (const [key, value] of Object.entries(legacy)) {
		const next = fillMissing(current[key], value);

		if (next !== current[key]) {
			merged ??= { ...current };
			merged[key] = next;
		}
	}

	return merged ?? current;
}

function renameBucket(name: string, target: string) {
	const legacy = settings[name] ?? {};

	for (const [key, value] of Object.entries(legacy)) {
		// A top-level key holding a dot cannot be addressed by a key path, so nothing ever wrote one.
		if (key.includes('.')) {
			continue;
		}

		const current = settings[target]?.[key];
		const merged = fillMissing(current, value);

		if (merged !== current) {
			set(target, key, merged);
		}
	}

	clear(name);
}

function renameStates(bucket: string) {
	const states = get<SettingsValue | undefined>(bucket, 'states', undefined);

	if (!isSettingsObject(states)) return;

	const renamed: SettingsObject = {};
	let changed = false;

	for (const [id, state] of Object.entries(states)) {
		const target = renamedId(id);

		if (!target) {
			renamed[id] = state;
			continue;
		}

		changed = true;
		renamed[target] = states[target] ?? state;
	}

	if (changed) {
		set(bucket, 'states', renamed);
	}
}

/**
 * @description Moves settings saved under the legacy `astral` names to the `unbound` names, once, before anything reads them.
 * A value already saved under the new name is kept: the loader kept writing its own keys to `unbound` throughout.
 */
export function renameLegacyBuckets(): void {
	for (const name of Object.keys(settings)) {
		const target = renamedId(name);

		if (target) {
			renameBucket(name, target);
		}
	}

	for (const bucket of ADDON_STATE_BUCKETS) {
		renameStates(bucket);
	}
}
