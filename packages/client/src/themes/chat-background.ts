import type { Theme } from '@unbound-app/types';

/** Where the chat background comes from: the applied theme's recommendation, the user's own image, or nowhere. */
export type ChatBackgroundSource = 'theme' | 'custom' | 'off';

/** A chat background to draw: the image, its blur radius, and how much of it shows through the chat colour. */
export type ChatBackground = {
	url: string;
	blur: number;
	opacity: number;
};

/** The user's chat background settings, as stored. */
export type ChatBackgroundSettings = {
	source: string;
	url: string;
	blur: number;
	opacity: number;
};

/** The opacity of a theme's background that leaves it out; half keeps messages readable over most images. */
export const DEFAULT_BACKGROUND_OPACITY = 0.5;

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

/**
 * @description Picks the chat background to draw: the theme's recommendation, the user's own image, or none.
 * @param theme The applied theme, if any.
 * @param settings The user's chat background settings.
 * @returns The background, or `undefined` when none applies.
 */
export function resolveChatBackground(
	theme: Theme | null | undefined,
	settings: ChatBackgroundSettings,
): ChatBackground | undefined {
	const chosen =
		settings.source === 'custom'
			? settings
			: settings.source === 'theme'
				? theme?.background
				: undefined;

	if (!chosen?.url) return;

	return {
		url: chosen.url,
		blur: Math.max(chosen.blur ?? 0, 0),
		opacity: clamp(chosen.opacity ?? DEFAULT_BACKGROUND_OPACITY, 0, 1),
	};
}
