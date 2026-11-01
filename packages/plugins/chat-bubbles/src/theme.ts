import { bubbleAppearance, type BubbleAppearance } from '~/style';
import { storage } from '@unbound-app/api';

import { settings, SETTINGS_BUCKET, ThemeStore } from '~/modules';

/**
 * @description Reads the bubble's look for the theme Discord is showing.
 * @returns The radius, padding and color from the plugin's settings.
 */
export function currentAppearance(): BubbleAppearance {
	return bubbleAppearance((key) => settings.get(key, undefined), ThemeStore.theme === 'light');
}

/**
 * @description Calls `listener` whenever the theme or a bubble setting changes.
 * @param listener The function to call.
 * @returns A function that stops listening.
 */
export function subscribeAppearance(listener: () => void): () => void {
	const unsubscribeSettings = storage.onChange(
		({ store }) => store === SETTINGS_BUCKET,
		listener,
	);

	ThemeStore.addChangeListener?.(listener);

	return () => {
		unsubscribeSettings();
		ThemeStore.removeChangeListener?.(listener);
	};
}

export default { currentAppearance, subscribeAppearance };
