import { Theme, ThemeStore } from '~/modules';

/**
 * @description Reads the theme Discord is currently showing.
 * @returns The theme name, falling back to dark.
 */
export function currentTheme(): string {
	return ThemeStore.theme ?? Theme.themes.DARK;
}

/**
 * @description Resolves one of Discord's semantic color tokens for the current theme.
 * @param token The token name in `Theme.colors`, such as `TEXT_MUTED`.
 * @returns The resolved color, usually a `#rrggbb` string.
 */
export function resolveColor(token: string): string {
	return Theme.internal.resolveSemanticColor(currentTheme(), Theme.colors[token]);
}

/**
 * @description Calls `listener` whenever the theme changes.
 * @param listener The function to call.
 * @returns A function that stops listening.
 */
export function subscribeTheme(listener: () => void): () => void {
	// The theme store is optional: without it the indicator keeps the dark theme's colors.
	if (!ThemeStore.addChangeListener) return () => {};

	ThemeStore.addChangeListener(listener);

	return () => ThemeStore.removeChangeListener(listener);
}

export default { currentTheme, resolveColor, subscribeTheme };
