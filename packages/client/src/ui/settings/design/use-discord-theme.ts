import { getStore, useStore, type FluxStore } from '~/flux/api';

import type { PickerTheme } from './appearance-picker';

type BaseTheme = PickerTheme['theme'];

type ThemeState = { theme?: string };

type ThemeStoreShape = FluxStore & { getState(): ThemeState };

const BASE_THEMES: BaseTheme[] = ['light', 'dark', 'darker', 'midnight'];

function hasThemeState(store: FluxStore): store is ThemeStoreShape {
	return 'getState' in store;
}

function isBaseTheme(theme: string | undefined): theme is BaseTheme {
	return BASE_THEMES.some((base) => base === theme);
}

/**
 * @description Follows Discord's own theme, the one it uses with no Unbound theme applied.
 * `getState()` answers it even while a theme overrides the store's `theme` getter.
 * @returns Discord's theme, or `darker` until its store is loaded.
 */
function useDiscordTheme(): BaseTheme {
	return useStore(getStore('Theme'), (store) => {
		const theme = hasThemeState(store) ? store.getState().theme : undefined;

		return isBaseTheme(theme) ? theme : 'darker';
	});
}

export default useDiscordTheme;
