import { isHexColor } from '@unbound-plugins/shared/colors/role-colors';

type Oklab = [number, number, number];

/**
 * @description Converts a `#rrggbb` color to the signed 32-bit opaque ARGB integer Discord's chat renderer uses.
 * @param hex The hex color.
 * @returns The ARGB color, or `null` when `hex` is not a hex color.
 */
export function hexToArgb(hex: string): number | null {
	if (!isHexColor(hex)) return null;

	return 0xff000000 | Number.parseInt(hex.slice(1), 16);
}

function toLinear(channel: number): number {
	const value = channel / 255;

	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number): number {
	const clamped = Math.min(1, Math.max(0, value));
	const encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;

	return Math.round(encoded * 255);
}

function toOklab(color: number): Oklab {
	const red = toLinear((color >>> 16) & 0xff);
	const green = toLinear((color >>> 8) & 0xff);
	const blue = toLinear(color & 0xff);
	const light = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
	const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
	const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

	return [
		0.2104542553 * light + 0.793617785 * medium - 0.0040720468 * short,
		1.9779984951 * light - 2.428592205 * medium + 0.4505937099 * short,
		0.0259040371 * light + 0.7827717662 * medium - 0.808675766 * short,
	];
}

function fromOklab([lightness, a, b]: Oklab, alpha: number): number {
	const light = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const red = fromLinear(4.0767416621 * light - 3.3077115913 * medium + 0.2309699292 * short);
	const green = fromLinear(-1.2684380046 * light + 2.6097574011 * medium - 0.3413193965 * short);
	const blue = fromLinear(-0.0041960863 * light - 0.7034186147 * medium + 1.707614701 * short);

	return (alpha & 0xff000000) | (red << 16) | (green << 8) | blue;
}

/**
 * @description Tints an ARGB color toward a role color in Oklab, keeping the base color's alpha.
 * @param base The color to tint.
 * @param role The role color to tint toward.
 * @param saturation How far to tint, from 0 (unchanged) to 100 (the role color).
 * @returns The tinted signed 32-bit ARGB color.
 */
export function blendArgb(base: number, role: number, saturation: number): number {
	const ratio = Math.min(100, Math.max(0, saturation)) / 100;

	if (ratio === 0) return base | 0;

	if (ratio === 1) return (base & 0xff000000) | (role & 0x00ffffff);

	const original = toOklab(base);
	const tint = toOklab(role);
	const mixed = original.map((value, index) => value * (1 - ratio) + tint[index] * ratio);

	return fromOklab([mixed[0], mixed[1], mixed[2]], base);
}

export default { hexToArgb, blendArgb };
