import type { Theme } from '@unbound-app/types';

/**
 * @description Applies a 0 to 1 opacity to a `#rrggbb` or `#rrggbbaa` colour, leaving other formats untouched.
 * @param color The colour to adjust.
 * @param opacity The opacity, clamped to 0 to 1.
 * @returns The colour with its alpha replaced.
 */
export function withOpacity(color: string, opacity: number): string {
	const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 255)
		.toString(16)
		.padStart(2, '0');

	if (/^#[0-9a-f]{6}$/i.test(color)) {
		return color + alpha;
	}

	if (/^#[0-9a-f]{8}$/i.test(color)) {
		return color.slice(0, 7) + alpha;
	}

	return color;
}

/**
 * @description Resolves one of Discord's semantic colours from a theme, following raw references into the theme's own raw colours and then Discord's.
 * @param theme The applied theme, if any.
 * @param name The semantic colour's name, such as `BACKGROUND_BASE_LOWER`.
 * @param discordRaw Discord's raw colours, used for raw references the theme does not define.
 * @returns The colour to use, or `undefined` to keep Discord's.
 */
export function resolveThemeColor(
	theme: Theme | null | undefined,
	name: string,
	discordRaw: Record<string, string> = {},
): string | undefined {
	const entry = theme?.semantic?.[name];

	if (!entry?.value) return;

	const value =
		entry.type === 'raw' ? (theme.raw?.[entry.value] ?? discordRaw[entry.value]) : entry.value;

	if (!value) return;

	return entry.opacity === undefined ? value : withOpacity(value, entry.opacity);
}
