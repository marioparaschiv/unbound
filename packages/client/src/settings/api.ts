import type { SettingsEntry } from '@unbound-app/types/settings';
import { createLogger } from '@unbound-app/logger';

import { stableType } from '~/hot-refresh/runtime';
import SettingsStore from '~/settings/state';

const Logger = createLogger('API', 'Settings');

/**
 * @description Registers one or more settings entries into the section registry, warning on key collisions.
 * @param entries The settings entries to register.
 */
export function registerSection(...entries: SettingsEntry[]) {
	const state = SettingsStore.getState();

	for (const entry of entries) {
		if (state.sections[entry.key]) {
			Logger.warn(`Overwriting existing settings entry: ${entry.key}`);
		}

		state.registerSection(withStableScreen(entry));
	}
}

/** @deprecated Use registerSection */
export const registerSettings = registerSection;

function withStableScreen(entry: SettingsEntry): SettingsEntry {
	const { getComponent } = entry.screen;

	return {
		...entry,
		screen: { ...entry.screen, getComponent: () => stableType(getComponent()) },
	};
}

/**
 * @description Removes one or more settings entries from the section registry by key.
 * @param keys The entry keys to remove.
 */
export function removeSection(...keys: string[]) {
	const state = SettingsStore.getState();

	for (const key of keys) {
		state.removeSection(key);
	}
}

/** @deprecated Use removeSection */
export const removeSettings = removeSection;

/**
 * @description Returns the current registry of settings entries.
 * @returns A record of entry key to its {@link SettingsEntry}.
 */
export function getSections(): Record<string, SettingsEntry> {
	return SettingsStore.getState().sections;
}

/** @deprecated Use getSections */
export const sections = getSections;

export default {
	registerSection,
	registerSettings,
	removeSection,
	removeSettings,
	getSections,
	sections,
};
