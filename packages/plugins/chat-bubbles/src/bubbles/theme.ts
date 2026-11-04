import { bubbleAppearance, type BubbleAppearance } from '~/bubbles/style';
import { settings } from '@unbound-app/settings';
import { flux, storage } from '@unbound-app/api';

import { ThemeStore } from '~/bubbles/modules';

function readSetting(key: string): unknown {
	return Reflect.get(settings, key);
}

/**
 * @description Reads the bubble's look for the theme Discord is showing.
 * @returns The radius, padding and color from the plugin's settings.
 */
export function currentAppearance(): BubbleAppearance {
	return bubbleAppearance(readSetting, ThemeStore.theme === 'light');
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

export default { currentAppearance, watchAppearance };
