import type { Theme as ThemeData } from '@unbound-app/types';

import { resolveThemeColor } from '~/themes/colors';
import { parseThemeBundle } from '~/themes/bundle';
import type { Addon } from '~/addons/addon';
import { Manager } from '~/addons/manager';

/** The four colours a picker swatch and preview draw an addon with. */
export type Palette = {
	base: string;
	surface: string;
	accent: string;
	text: string;
};

// Discord's background tiers, from the server rail to the panels. A theme that paints them alike is flat; one that
// paints them apart reads as a gradient.
const BACKGROUND_TOKENS = [
	'BACKGROUND_BASE_LOWEST',
	'BACKGROUND_BASE_LOWER',
	'BACKGROUND_BASE_LOW',
];

/** What a theme that leaves a colour unset falls back to: Discord's own colours for its base theme. */
const FALLBACKS: Record<ThemeData['type'], Palette> = {
	light: { base: '#fbfbfb', surface: '#ffffff', accent: '#5865f2', text: '#28282d' },
	dark: { base: '#323339', surface: '#393a41', accent: '#5865f2', text: '#ffffff' },
	darker: { base: '#1a1a1e', surface: '#242429', accent: '#5865f2', text: '#fbfbfb' },
	midnight: { base: '#000000', surface: '#0a0a0c', accent: '#5865f2', text: '#dcdcdf' },
};

// Discord's raw BRAND_500, GREEN_360, ORANGE_345, RED_400, TEAL_345, YELLOW_300 and BLUE_345, copied because a
// theme's raw overrides recolour the live tokens.
/** Tints for icon packs, which carry no colours of their own, ordered so neighbours sit far apart in hue. */
const TINTS = ['#5865f2', '#23a55a', '#f1882a', '#f23f43', '#2eb0c9', '#f0b232', '#00aafc'];

/**
 * @description Reads Discord's own background colour for a base theme.
 * @param type The base theme.
 * @returns Its background colour.
 */
export function baseColorOf(type: ThemeData['type']): string {
	return FALLBACKS[type].base;
}

function hashOf(id: string): number {
	let hash = 0;

	for (let i = 0, len = id.length; i < len; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;

	return Math.abs(hash);
}

const parsed = new WeakMap<Addon, ThemeData | null>();

/**
 * @description Reads a theme's definition. Only the applied theme is started, so the others are parsed from their bundle.
 * @param addon The theme or icon pack.
 * @returns The theme, or `null` for an icon pack or a bundle that does not parse.
 */
export function themeOf(addon: Addon): ThemeData | null {
	if (addon.instance) {
		return addon.instance as ThemeData;
	}

	// The theme manager owns it: a manifest's `type` is optional, so most themes leave it out.
	if (Manager.for('theme').getAddon(addon.id) !== addon || !addon.bundle) return null;

	if (!parsed.has(addon)) {
		try {
			parsed.set(addon, parseThemeBundle(addon.bundle));
		} catch {
			// A bundle the manager could not load either; the picker draws it with the fallback colours.
			parsed.set(addon, null);
		}
	}

	return parsed.get(addon) ?? null;
}

/**
 * @description Reads the distinct colours a theme paints Discord's background tiers with, in tier order.
 * @param theme The theme.
 * @returns Its background colours; fewer than two when the theme's background is flat.
 */
export function backgroundsOf(theme: ThemeData): string[] {
	const colors = BACKGROUND_TOKENS.map((name) => resolveThemeColor(theme, name)?.toLowerCase());

	return [...new Set(colors.filter((color) => color !== undefined))];
}

/**
 * @description Reads the colours to draw an addon with: a theme's own, or a stable tint for an icon pack.
 * @param addon The theme or icon pack.
 * @param slot Picks an icon pack's tint. Pass its list index so neighbours differ; defaults to a hash of its id.
 * @returns Its palette.
 */
export function paletteOf(addon: Addon, slot = hashOf(addon.id)): Palette {
	const theme = themeOf(addon);
	const fallback = FALLBACKS[theme?.type ?? 'darker'];

	if (!theme?.semantic) {
		return { ...fallback, accent: TINTS[slot % TINTS.length] };
	}

	return {
		base: resolveThemeColor(theme, 'BACKGROUND_BASE_LOWER') ?? fallback.base,
		surface: resolveThemeColor(theme, 'BACKGROUND_SURFACE_HIGH') ?? fallback.surface,
		accent: resolveThemeColor(theme, 'BACKGROUND_BRAND') ?? fallback.accent,
		text: resolveThemeColor(theme, 'TEXT_STRONG') ?? fallback.text,
	};
}
