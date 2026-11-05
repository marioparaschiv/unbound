import { messages } from '~/i18n/api';

import type { PickerTheme } from './appearance-picker';

import { plainSwatch } from './picker-theme';

/** The id the "Default" swatch carries in place of an addon's. */
export const DEFAULT_THEME_ID = 'unbound.default-theme';

/**
 * @description The picker swatch that clears the applied theme: a plain swatch of Discord's own theme, faked like an
 * addon's so moving onto it from a theme clears that theme's gradient.
 * @param theme Discord's own theme.
 * @returns The swatch, tagged with {@link DEFAULT_THEME_ID}.
 */
export function defaultThemeSwatch(theme: PickerTheme['theme']): PickerTheme {
	return plainSwatch(theme, () => messages.UNBOUND_DEFAULT_THEME, DEFAULT_THEME_ID);
}
