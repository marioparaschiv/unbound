import { bubbleAppearance, type BubbleAppearance } from '~/style';
import { settings, ThemeStore } from '~/modules';

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
	const unsubscribeSettings = settings.addListener(() => true, listener);

	ThemeStore.addChangeListener?.(listener);

	return () => {
		unsubscribeSettings();
		ThemeStore.removeChangeListener?.(listener);
	};
}

export default { currentAppearance, subscribeAppearance };
