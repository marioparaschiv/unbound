import type { SettingsObject, SettingsValue } from '@unbound-app/types';
import { CORE_SETTINGS_STORE } from '@unbound-app/types/settings';

import { clear, get, set, snapshot } from '~/storage/api';

const LEGACY_NAME = 'astral';
const LEGACY_PREFIX = `${LEGACY_NAME}.`;

// Device-local, so Sync never carries the flag to a device that still has `astral` Buckets.
const MIGRATIONS_BUCKET = 'unbound::migrations';
const RENAMED_KEY = 'legacy-buckets';

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

function withMissingFromLegacy(
	current: SettingsValue | undefined,
	legacy: SettingsValue,
): SettingsValue | undefined {
	if (current === undefined) {
		return legacy;
	}

	if (!isSettingsObject(current) || !isSettingsObject(legacy)) {
		return undefined;
	}

	let merged: SettingsObject | undefined;

	for (const [key, value] of Object.entries(legacy)) {
		const next = withMissingFromLegacy(current[key], value);

		if (next !== undefined) {
			merged ??= { ...current };
			merged[key] = next;
		}
	}

	return merged;
}

function fillBucketFromLegacy(name: string, target: string) {
	const legacy = get<SettingsValue | undefined>(name, '', undefined);

	for (const [key, value] of Object.entries(isSettingsObject(legacy) ? legacy : {})) {
		const merged = withMissingFromLegacy(
			get<SettingsValue | undefined>(target, key, undefined),
			value,
		);

		if (merged !== undefined) {
			set(target, key, merged);
		}
	}

	clear(name);
}

function moveLegacyStatesOver(bucket: string) {
	const states = get<SettingsValue | undefined>(bucket, 'states', undefined);

	if (!isSettingsObject(states)) return;

	const renamed: SettingsObject = {};
	const legacy: [string, SettingsValue][] = [];

	for (const [id, state] of Object.entries(states)) {
		const target = renamedId(id);

		if (target) {
			legacy.push([target, state]);
		} else {
			renamed[id] = state;
		}
	}

	if (!legacy.length) return;

	for (const [target, state] of legacy) {
		renamed[target] = state;
	}

	set(bucket, 'states', renamed);
}

/**
 * @description Moves settings saved under the legacy `astral` names to the `unbound` names, once, before anything reads them.
 * A Bucket value already saved under the new name is kept: the loader kept writing its own keys to `unbound` throughout.
 */
export function renameLegacyBuckets(): void {
	// Listing Buckets copies the whole settings file into JS, so it runs on one launch only.
	if (!get(MIGRATIONS_BUCKET, RENAMED_KEY, false)) {
		for (const name of Object.keys(snapshot())) {
			const target = renamedId(name);

			if (target) {
				fillBucketFromLegacy(name, target);
			}
		}

		set(MIGRATIONS_BUCKET, RENAMED_KEY, true);
	}

	moveLegacyStatesOver('plugins');
}
