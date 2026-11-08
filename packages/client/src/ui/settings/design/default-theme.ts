import { messages } from '~/i18n/api';

import type { PickerTheme } from './appearance-picker';

/** The id the "Default" swatch carries in place of an addon's. */
export const DEFAULT_THEME_ID = 'unbound.default-theme';

/**
 * @description The picker swatch that clears the applied theme: Discord's own swatch for its theme, so the swatch keeps
 * its border and the page around the preview keeps Discord's colours instead of the darker gradient-theme backdrop.
 * @param theme Discord's own theme.
 * @returns The swatch, tagged with {@link DEFAULT_THEME_ID}.
 */
export function defaultThemeSwatch(theme: PickerTheme['theme']): PickerTheme {
	return {
		type: 'standardBackgroundTheme',
		theme,
		getName: () => messages.UNBOUND_DEFAULT_THEME,
		unboundAddonId: DEFAULT_THEME_ID,
	};
}
