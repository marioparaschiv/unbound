import type { Theme } from '@unbound-app/types';

/** One token a colour pick writes, at an optional fixed opacity. */
export type TokenWrite = {
	token: string;
	opacity?: number;
};

/** A parsed colour: its 0xRRGGBB value and its 0 to 1 alpha. */
export type ParsedColor = {
	rgb: number;
	alpha: number;
};

/** Reads the opacity Discord draws a token with now, for tokens the draft does not set yet. */
export type OpacityLookup = (token: string) => number | undefined;

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL = /^(rgba?|hsla?)\(\s*([^)]*)\)$/i;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function parseHex(digits: string): ParsedColor {
	const full = digits.length <= 4 ? digits.replace(/./g, '$&$&') : digits;
	const rgb = parseInt(full.slice(0, 6), 16);
	const alpha = full.length === 8 ? parseInt(full.slice(6), 16) / 255 : 1;

	return { rgb, alpha };
}

function parseAlpha(part: string | undefined): number {
	if (part === undefined) {
		return 1;
	}

	const value = parseFloat(part);

	return clamp(part.endsWith('%') ? value / 100 : value, 0, 1);
}

function hslToRgb(hue: number, saturation: number, lightness: number): number {
	const amount = saturation * Math.min(lightness, 1 - lightness);

	function channel(offset: number): number {
		const k = (offset + hue / 30) % 12;

		return Math.round((lightness - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
	}

	return (channel(0) << 16) | (channel(8) << 8) | channel(4);
}

function parseFunctional(kind: string, body: string): ParsedColor | undefined {
	const parts = body.split(/[\s,/]+/).filter(Boolean);

	if (parts.length < 3 || parts.slice(0, 3).some((part) => Number.isNaN(parseFloat(part)))) {
		return undefined;
	}

	const alpha = parseAlpha(parts[3]);

	if (kind.startsWith('hsl')) {
		const hue = ((parseFloat(parts[0]) % 360) + 360) % 360;
		const saturation = clamp(parseFloat(parts[1]) / 100, 0, 1);
		const lightness = clamp(parseFloat(parts[2]) / 100, 0, 1);

		return { rgb: hslToRgb(hue, saturation, lightness), alpha };
	}

	const [red, green, blue] = parts
		.slice(0, 3)
		.map((part) =>
			Math.round(
				clamp(part.endsWith('%') ? parseFloat(part) * 2.55 : parseFloat(part), 0, 255),
			),
		);

	return { rgb: (red << 16) | (green << 8) | blue, alpha };
}

/**
 * @description Parses a colour string as Discord's resolver returns it.
 * @param color A `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()` or `hsla()` colour.
 * @returns The colour's value and alpha, or `undefined` for any other format.
 */
export function parseColor(color: string): ParsedColor | undefined {
	const value = color.trim();
	const hex = HEX.exec(value);

	if (hex) {
		return parseHex(hex[1]);
	}

	const functional = FUNCTIONAL.exec(value);

	return functional ? parseFunctional(functional[1].toLowerCase(), functional[2]) : undefined;
}

/**
 * @description Formats a 0xRRGGBB integer as a bundle colour.
 * @param color The colour as an integer.
 * @returns The colour as lowercase `#rrggbb`.
 */
export function intToHex(color: number): string {
	return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

/**
 * @description Creates an empty draft, so every token follows Discord until the user changes it.
 * @param type The appearance the theme is designed against.
 * @returns A theme with no colours set.
 */
export function createDraft(type: Theme['type']): Theme {
	return { semantic: {}, raw: {}, type };
}

/**
 * @description Reads a saved bundle back into a draft, keeping every field it carries.
 * @param bundle The theme's `bundle.json` text.
 * @returns The theme, or `undefined` when the bundle is not a theme object.
 */
export function readDraft(bundle: string): Theme | undefined {
	try {
		const theme: Theme | null = JSON.parse(bundle);

		if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
			return undefined;
		}

		return { ...theme, semantic: theme.semantic ?? {}, raw: theme.raw ?? {} };
	} catch {
		return undefined;
	}
}

/**
 * @description Tells whether the draft sets any of the tokens.
 * @param draft The draft.
 * @param tokens The token names.
 * @returns Whether at least one token is set.
 */
export function isEdited(draft: Theme, tokens: readonly string[]): boolean {
	return tokens.some((token) => token in draft.semantic);
}

/**
 * @description Writes a picked colour to every token, unless the pick is the colour the picker opened with.
 * @param draft The draft.
 * @param writes The tokens to write, each with an optional fixed opacity.
 * @param from The colour the picker opened with, or `undefined` when it was unknown.
 * @param to The picked colour.
 * @param discordOpacity Reads Discord's opacity for a token the draft does not set.
 * @returns A new draft, or the same draft when nothing changed.
 */
export function applyPick(
	draft: Theme,
	writes: readonly TokenWrite[],
	from: number | undefined,
	to: number,
	discordOpacity: OpacityLookup = () => undefined,
): Theme {
	// Discord's picker also reports the starting colour when it is dismissed.
	if (from === to) {
		return draft;
	}

	const semantic = { ...draft.semantic };
	const value = intToHex(to);

	for (const { token, opacity: fixed } of writes) {
		const existing = draft.semantic[token];
		const opacity = fixed ?? (existing ? existing.opacity : discordOpacity(token));

		semantic[token] =
			opacity === undefined || opacity >= 1
				? { type: 'color', value }
				: { type: 'color', value, opacity };
	}

	return { ...draft, semantic };
}

/**
 * @description Removes tokens from the draft, so they follow Discord again.
 * @param draft The draft.
 * @param tokens The token names.
 * @returns A new draft, or the same draft when none of the tokens was set.
 */
export function resetTokens(draft: Theme, tokens: readonly string[]): Theme {
	if (!isEdited(draft, tokens)) {
		return draft;
	}

	const semantic = { ...draft.semantic };

	for (const token of tokens) {
		delete semantic[token];
	}

	return { ...draft, semantic };
}

export default {
	parseColor,
	intToHex,
	createDraft,
	readDraft,
	isEdited,
	applyPick,
	resetTokens,
};
