import { Theme } from '~/modules';

export type ReviewColors = ReturnType<typeof getReviewColors>;

function color(key: string, fallback: string): string {
	// Optional: without the theme module, every color falls back.
	const value = Theme.colors?.[key];

	return typeof value === 'string' ? value : fallback;
}

/**
 * @description Resolves the review sheets' palette from Discord's theme, with dark-theme defaults for missing keys.
 * @returns The palette, keyed by role.
 */
export function getReviewColors() {
	return {
		page: color('BACKGROUND_MOBILE_PRIMARY', color('BACKGROUND_PRIMARY', '#111214')),
		surface: color('BACKGROUND_SECONDARY', '#1e1f22'),
		surfaceAlt: color('BACKGROUND_SECONDARY_ALT', '#232428'),
		input: color('BACKGROUND_TERTIARY', '#111214'),
		border: color('BACKGROUND_MODIFIER_ACCENT', '#4e5058'),
		text: color('TEXT_NORMAL', '#f2f3f5'),
		muted: color('TEXT_MUTED', '#b5bac1'),
		accent: color('BRAND_500', '#5865f2'),
		accentText: '#ffffff',
		positive: color('GREEN_360', '#23a559'),
		danger: color('RED_400', '#ed4245'),
		link: color('TEXT_LINK', '#00a8fc'),
	};
}

export default { getReviewColors };
