import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { placeholderLightness } from '~/lib/brightness';
import { isNightHour } from '~/lib/schedule';

type ThemeStore = { theme?: string };

/**
 * @description Says whether images are dimmed right now: always, during the night hours, or while the theme is dark.
 * @returns Whether to dim.
 */
export function isActive(): boolean {
	if (settings.when === 'always') return true;

	if (settings.when === 'night') {
		return isNightHour(new Date().getHours(), settings.nightStart, settings.nightEnd);
	}

	return (flux.getStore('Theme') as unknown as ThemeStore).theme !== 'light';
}

/**
 * @description Says whether an image is bright enough to dim, from its ThumbHash placeholder.
 * @param placeholder The placeholder, missing for images still uploading or added locally.
 * @returns Whether to dim it; an image without a placeholder follows `dimUnknown`.
 */
export function isBrightPlaceholder(placeholder: string | null | undefined): boolean {
	if (!placeholder) return settings.dimUnknown;

	return (placeholderLightness(placeholder) ?? 0) >= settings.brightness / 100;
}

/**
 * @description Reads the opacity a dimmed image draws with.
 * @returns The opacity, from 0 to 1.
 */
export function dimmedOpacity(): number {
	return 1 - settings.dim / 100;
}
