import { BubbleStyle } from '~/constants';
import { ThemeStore } from '~/modules';

export type BubbleColor = (typeof BubbleStyle)['dark'];

/**
 * @description Picks the bubble color for the theme Discord is showing.
 * @returns A translucent black on dark themes and a translucent white on the light theme.
 */
export function bubbleColor(): BubbleColor {
	return ThemeStore.theme === 'light' ? BubbleStyle.light : BubbleStyle.dark;
}

/**
 * @description Packs a bubble color into an Android ARGB integer.
 * @param color The color.
 * @returns The signed 32-bit ARGB value.
 */
export function argb({ red, green, blue, alpha }: BubbleColor): number {
	const channel = (value: number) => Math.round(value * 255);

	return (
		(channel(alpha) << 24) | (channel(red) << 16) | (channel(green) << 8) | channel(blue) | 0
	);
}

/**
 * @description Calls `listener` whenever the theme changes.
 * @param listener The function to call.
 * @returns A function that stops listening.
 */
export function subscribeTheme(listener: () => void): () => void {
	if (!ThemeStore.addChangeListener) return () => {};

	ThemeStore.addChangeListener(listener);

	return () => ThemeStore.removeChangeListener(listener);
}

export default { argb, bubbleColor, subscribeTheme };
