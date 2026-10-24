import { DEFAULT_THEME } from '~/constants';
import { settings } from '~/modules';

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
 * @description Reads the user's settings, clamped to values the renderer understands.
 * @returns The active theme (a custom URL wins as `custom:<url>`), opacity, overflow, icon mode and Highlight.js preference.
 */
export function readPreferences(): Preferences {
	const custom = String(settings.get('customTheme', '')).trim();
	const opacity = Number(settings.get('bgOpacity', 100));
	const iconMode = settings.get('useDevIcon', 'greyscale');

	return {
		theme: custom ? `custom:${custom}` : String(settings.get('theme', DEFAULT_THEME)),
		opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(100, opacity)) : 100,
		overflow: settings.get('lineOverflow', 'wrap') === 'scroll' ? 'scroll' : 'wrap',
		iconMode: iconMode === 'disabled' || iconMode === 'colored' ? iconMode : 'greyscale',
		hljs: String(settings.get('tryHljs', 'secondary')),
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
