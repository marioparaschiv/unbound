import {
	bubbleAppearance,
	parseHexColor,
	type BubbleAppearance,
	type BubbleColor,
} from '~/lib/style';
import { settings } from '@unbound-app/settings';
import { flux, storage } from '@unbound-app/api';

import { BubbleStyle } from '~/lib/constants';
import { shadeColor } from '~/lib/shade';
import { Theme, ThemeStore } from '~/lib/modules';

/** The semantic color Discord paints the chat with, then an older name for the same surface. */
const CHAT_BACKGROUND_TOKENS = ['CHANNEL_BACKGROUND_DEFAULT', 'BACKGROUND_BASE_LOWER'];

function readSetting(key: string): unknown {
	return Reflect.get(settings, key);
}

// Custom themes patch the resolver too, so this follows them; it may give `#rrggbbaa`, whose alpha is dropped.
function themeColor(tokens: string[]): Omit<BubbleColor, 'alpha'> | undefined {
	try {
		const resolve = Theme.internal?.resolveSemanticColor;
		const token = tokens.map((name) => Theme.colors?.[name]).find(Boolean);

		if (typeof resolve !== 'function' || token === undefined) return;

		const value: unknown = resolve(ThemeStore.theme ?? Theme.themes?.DARK, token);

		return typeof value === 'string' ? parseHexColor(value.slice(0, 7)) : undefined;
	} catch {
		// Without Discord's theme module the fixed fallback below is used.
		return undefined;
	}
}

/**
 * @description Works out the default bubble color: a shade darker than the chat's background in the theme Discord is showing.
 * @returns The color's channels from 0 to 1.
 */
export function themeBubbleColor(): Omit<BubbleColor, 'alpha'> {
	const background = themeColor(CHAT_BACKGROUND_TOKENS);

	if (background) return shadeColor(background, BubbleStyle.themeShade);

	return ThemeStore.theme === 'light' ? BubbleStyle.light : BubbleStyle.dark;
}

/**
 * @description Reads the bubble's look for the theme Discord is showing.
 * @returns The radius, padding and color from the plugin's settings.
 */
export function currentAppearance(): BubbleAppearance {
	return bubbleAppearance(readSetting, themeBubbleColor());
}

/**
 * @description Calls `listener` whenever the theme or a bubble setting changes. The Addon scope also stops both listeners when the plugin stops.
 * @param listener The function to call.
 * @returns A function that stops both listeners.
 */
export function watchAppearance(listener: () => void): () => void {
	const stopSettings = storage.onChange(({ store }) => store === addon.id, listener);
	const stopTheme = flux.onStoreChange(ThemeStore, listener);

	return () => {
		stopSettings();
		stopTheme();
	};
}

export default { currentAppearance, themeBubbleColor, watchAppearance };
