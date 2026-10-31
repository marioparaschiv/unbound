import type { SettingsObject, SettingsValue } from '@unbound-app/types';
import { CORE_SETTINGS_STORE } from '@unbound-app/types/settings';

import { clear, get, set, settings } from '~/storage/api';

const LEGACY_NAME = 'astral';
const LEGACY_PREFIX = `${LEGACY_NAME}.`;

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
	for (const [key, value] of Object.entries(settings[name] ?? {})) {
		const merged = withMissingFromLegacy(settings[target]?.[key], value);

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
	for (const name of Object.keys(settings)) {
		const target = renamedId(name);

		if (target) {
			fillBucketFromLegacy(name, target);
		}
	}

	moveLegacyStatesOver('plugins');
}
