import { metro } from '@unbound-app/api';

export type ReviewColors = ReturnType<typeof getReviewColors>;

function color(key: string, fallback: string): string {
	// Optional: without the theme module, every color falls back.
	const value = metro.common.Theme.colors?.[key];

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

type Rgb = [number, number, number];

const hex = ([red, green, blue]: Rgb) =>
	`#${[red, green, blue].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

function rgbOf(color: string | number): Rgb | undefined {
	const value = typeof color === 'number' ? color : Number.parseInt(color.replace(/^#/, ''), 16);

	if (!Number.isFinite(value) || (typeof color === 'string' && !/^#?[\da-f]{6}$/i.test(color)))
		return;

	return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

const LIGHT_LUMA = 160;

function isLight([red, green, blue]: Rgb): boolean {
	return (red * 299 + green * 587 + blue * 114) / 1000 > LIGHT_LUMA;
}

function mix(color: string, tint: Rgb, amount: number): string {
	const base = rgbOf(color);

	if (!base) return color;

	return hex(base.map((channel, index) => channel + (tint[index]! - channel) * amount) as Rgb);
}

/**
 * @description Tints the review sheets' palette with a profile's two theme colors, the way a Nitro profile is themed:
 * the backgrounds take the primary color and the send button and borders the accent.
 * @param base The theme's palette.
 * @param theme The profile's primary and accent colors.
 * @returns The tinted palette, or `base` when the colors are unreadable.
 */
export function themedReviewColors(
	base: ReviewColors,
	theme: readonly number[] | undefined,
): ReviewColors {
	const primary = theme?.[0] === undefined ? undefined : rgbOf(theme[0]);
	const accent = theme?.[1] === undefined ? undefined : rgbOf(theme[1]);

	if (!primary || !accent) return base;

	return {
		...base,
		page: mix(base.page, primary, 0.35),
		surface: mix(base.surface, primary, 0.28),
		surfaceAlt: mix(base.surfaceAlt, primary, 0.22),
		input: mix(base.input, accent, 0.18),
		border: mix(base.border, accent, 0.5),
		accent: hex(accent),
		accentText: isLight(accent) ? '#000000' : '#ffffff',
	};
}
