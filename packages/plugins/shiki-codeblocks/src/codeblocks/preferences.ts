import { settings } from '@unbound-app/settings';

export type LineOverflow = 'wrap' | 'scroll';
export type IconMode = 'disabled' | 'greyscale' | 'colored';

export type Preferences = {
	theme: string;
	opacity: number;
	overflow: LineOverflow;
	iconMode: IconMode;
	hljs: string;
};

/**
 * @description Reads the user's settings.
 * @returns The active theme (a custom URL wins as `custom:<url>`), opacity, overflow, icon mode and Highlight.js preference.
 */
export function readPreferences(): Preferences {
	const custom = settings.customTheme.trim();

	return {
		theme: custom ? `custom:${custom}` : settings.theme,
		opacity: settings.bgOpacity,
		overflow: settings.lineOverflow,
		iconMode: settings.useDevIcon,
		hljs: settings.tryHljs,
	};
}

/**
 * @description Tells whether a setting changes a card's geometry, so mounted cards must be rebuilt instead of repainted.
 * @param key The setting that changed.
 * @returns `true` for line overflow and language icons.
 */
export function changesCardLayout(key: string): boolean {
	return key === 'lineOverflow' || key === 'useDevIcon';
}

export default { readPreferences, changesCardLayout };
