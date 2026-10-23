import type { SettingsEntry } from '@unbound-app/types/settings';
import { createLogger } from '@unbound-app/logger';

import { stableType } from '~/lib/hot/runtime';
import SettingsStore from '~/stores/settings';

const Logger = createLogger('API', 'Settings');

/**
 * @description Registers one or more settings entries into the section registry, warning on key collisions.
 * @param entries The settings entries to register.
 */
export function registerSettings(...entries: SettingsEntry[]) {
	const { sections, registerSection } = SettingsStore.getState();

	for (const entry of entries) {
		if (sections[entry.key]) {
			Logger.warn(`Overwriting existing settings entry: ${entry.key}`);
		}

		registerSection(withStableScreen(entry));
	}
}

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
export function removeSettings(...keys: string[]) {
	const { removeSection } = SettingsStore.getState();

	for (const key of keys) {
		removeSection(key);
	}
}

/**
 * @description Returns the current registry of settings entries.
 * @returns A record of entry key to its {@link SettingsEntry}.
 */
export function sections(): Record<string, SettingsEntry> {
	return SettingsStore.getState().sections;
}

export default { registerSettings, removeSettings, sections };
