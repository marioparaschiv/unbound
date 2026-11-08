import { getStore, useStore, type FluxStore } from '~/flux/api';

import type { PickerTheme } from './appearance-picker';

type BaseTheme = PickerTheme['theme'];

type ThemeState = { theme?: string };

type ThemeStoreShape = FluxStore & {
	systemTheme?: string;
	isSameAsDeviceThemeEnabled?(): boolean;
	themePreferenceForSystemTheme?(systemTheme: string | undefined): string | undefined;
	getState?(): ThemeState;
};

type SettingsStoreShape = FluxStore & { settings?: { appearance?: { theme?: number } } };

const BASE_THEMES: BaseTheme[] = ['light', 'dark', 'darker', 'midnight'];

// Discord's synced `appearance.theme` enum: 0 is unset.
const SYNCED_THEMES: Record<number, BaseTheme> = {
	1: 'dark',
	2: 'light',
	3: 'darker',
	4: 'midnight',
};

function isBaseTheme(theme: string | undefined): theme is BaseTheme {
	return BASE_THEMES.some((base) => base === theme);
}

function chosenTheme(themes: ThemeStoreShape, settings: SettingsStoreShape): BaseTheme {
	if (themes.isSameAsDeviceThemeEnabled?.()) {
		const preferred = themes.themePreferenceForSystemTheme?.(themes.systemTheme);

		if (isBaseTheme(preferred)) {
			return preferred;
		}
	}

	const synced = SYNCED_THEMES[settings.settings?.appearance?.theme ?? 0];

	if (synced) {
		return synced;
	}

	const stored = themes.getState?.().theme;

	return isBaseTheme(stored) ? stored : 'darker';
}

/**
 * @description Follows the theme the user chose in Discord, the one it uses with no Unbound theme applied. Read from
 * the synced setting: while a theme is applied, the theme store can hold that theme's base instead.
 * @returns Discord's theme, or `darker` until its stores are loaded.
 */
function useDiscordTheme(): BaseTheme {
	const themes: ThemeStoreShape = getStore('Theme');
	const settings: SettingsStoreShape = getStore('UserSettingsProto');

	return useStore([themes, settings], () => chosenTheme(themes, settings));
}

export default useDiscordTheme;
