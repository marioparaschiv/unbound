// Ported from the OKLCH generator proven on device; greys now keep Discord's own tint, shifted by the user's.

type Rgb = [number, number, number];

type Oklch = {
	L: number;
	C: number;
	h: number;
};

type ParsedHex = {
	rgb: Rgb;
	/** The two alpha hex digits of an 8-digit colour, or `''`. */
	alpha: string;
};

type Transform = (hex: string) => string;

/** The three colours a theme is made from. */
export type ThemeColors = {
	background: string;
	accent: string;
	mention: string;
};

/** Raw colour names to hex, as Discord names them. */
export type RawColors = Record<string, string>;

/** Discord's own themes, which a theme builds on: its tokens resolve the way that theme's do. */
export type ThemeBase = 'dark' | 'darker' | 'midnight' | 'light';

/** The raw each base paints the chat with (`CHANNEL_BACKGROUND_DEFAULT`), where the background ramp is anchored. */
export const BASE_ANCHORS: Record<ThemeBase, string> = {
	dark: 'NEUTRAL_69',
	darker: 'NEUTRAL_86',
	midnight: 'NEUTRAL_100',
	light: 'NEUTRAL_2',
};

const FAMILIES: [RegExp, keyof ThemeColors][] = [
	[/^(NEUTRAL|PRIMARY|PLUM)_\d+$/, 'background'],
	[/^OPACITY_\d+$/, 'background'],
	[/^(BLURPLE|BRAND)_\d+$/, 'accent'],
	[/^OPACITY_BLURPLE_\d+$/, 'accent'],
	[/^(YELLOW|YELLOW_NEW)_\d+$/, 'mention'],
	[/^OPACITY_YELLOW_\d+$/, 'mention'],
];

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function parse(hex: string): ParsedHex {
	const h = hex.replace('#', '');
	const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;

	return { rgb: [n(0), n(2), n(4)], alpha: h.length === 8 ? h.slice(6, 8) : '' };
}

function toOklch([r, g, b]: Rgb): Oklch {
	const lr = toLinear(r);
	const lg = toLinear(g);
	const lb = toLinear(b);
	const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
	const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
	const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
	const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
	const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
	const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

	return { L, C: Math.hypot(A, B), h: Math.atan2(B, A) };
}

function fromOklch({ L, C, h }: Oklch): Rgb {
	const A = C * Math.cos(h);
	const B = C * Math.sin(h);
	const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
	const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
	const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;

	return [
		toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
	];
}

// Lowers chroma until the colour fits sRGB, so bright ramp ends stay in gamut.
function toHex(lch: Oklch, alpha = '') {
	const c = { ...lch };

	for (let i = 0; i < 24; i++) {
		const rgb = fromOklch(c);

		if (rgb.every((v) => v >= -0.001 && v <= 1.001)) {
			break;
		}

		c.C *= 0.92;
	}

	const rgb = fromOklch(c).map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));

	return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('') + alpha;
}

// Moves a ramp's lightness so its anchor lands on the user's colour, stretching each side to keep both ends.
function remapLightness(L: number, from: number, to: number) {
	if (L <= from) {
		return from === 0 ? L : (L / from) * to;
	}

	return to + ((L - from) * (1 - to)) / (1 - from);
}

function chromatic(anchorHex: string, userHex: string): Transform {
	const a = toOklch(parse(anchorHex).rgb);
	const u = toOklch(parse(userHex).rgb);

	return (hex) => {
		const { rgb, alpha } = parse(hex);
		const c = toOklch(rgb);

		return toHex(
			{
				L: remapLightness(c.L, a.L, u.L),
				C: c.C * (u.C / Math.max(a.C, 1e-4)),
				h: c.h + (u.h - a.h),
			},
			alpha,
		);
	};
}

// Shifts each grey's own tint by how far the user's colour sits from the anchor's, fading toward white and black,
// so Discord's own anchor reproduces Discord's greys.
function neutral(anchorHex: string, userHex: string): Transform {
	const a = toOklch(parse(anchorHex).rgb);
	const u = toOklch(parse(userHex).rgb);
	const shiftA = u.C * Math.cos(u.h) - a.C * Math.cos(a.h);
	const shiftB = u.C * Math.sin(u.h) - a.C * Math.sin(a.h);
	const bump = (L: number) => L * (1 - L);

	return (hex) => {
		const { rgb, alpha } = parse(hex);
		const c = toOklch(rgb);
		const L = remapLightness(c.L, a.L, u.L);
		const weight = Math.min(1.2, bump(L) / Math.max(bump(u.L), 1e-4));
		const A = c.C * Math.cos(c.h) + shiftA * weight;
		const B = c.C * Math.sin(c.h) + shiftB * weight;

		return toHex({ L, C: Math.hypot(A, B), h: Math.atan2(B, A) }, alpha);
	};
}

/**
 * @description Names the user colour a raw colour is re-anchored on.
 * @param name The raw colour's name.
 * @returns The colour's key, or `undefined` for a raw the generator leaves as Discord ships it.
 */
export function getRampFamily(name: string): keyof ThemeColors | undefined {
	return FAMILIES.find(([pattern]) => pattern.test(name))?.[1];
}

/**
 * @description Re-anchors Discord's ramps: background on the base's chat raw, accent on BLURPLE_50, mention on YELLOW_300.
 * @param raws Discord's raw colours, name to hex; must hold the anchors.
 * @param colors The user's three colours.
 * @param base The Discord theme the colours build on.
 * @returns Every re-anchored raw colour, name to hex.
 */
export function generateRaws(
	raws: RawColors,
	{ background, accent, mention }: ThemeColors,
	base: ThemeBase = 'dark',
): RawColors {
	const transforms: Record<keyof ThemeColors, Transform> = {
		background: neutral(raws[BASE_ANCHORS[base]] ?? '#323339', background),
		accent: chromatic(raws.BLURPLE_50 ?? '#5865f2', accent),
		mention: chromatic(raws.YELLOW_300 ?? '#f0b232', mention),
	};
	const out: RawColors = {};

	for (const [name, hex] of Object.entries(raws)) {
		const family = getRampFamily(name);

		if (family) {
			out[name] = transforms[family](hex);
		}
	}

	return out;
}

export default { BASE_ANCHORS, generateRaws, getRampFamily };
