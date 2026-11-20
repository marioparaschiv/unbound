export type Vision = 'protanopia' | 'deuteranopia' | 'tritanopia';

type Vector = [number, number, number];
type Matrix = [Vector, Vector, Vector];

const RGB_TO_LMS: Matrix = [
	[17.8824, 43.5161, 4.11935],
	[3.45565, 27.1554, 3.86714],
	[0.0299566, 0.184309, 1.46709],
];

const LMS_TO_RGB: Matrix = [
	[0.0809444479, -0.130504409, 0.116721066],
	[-0.0102485335, 0.0540193266, -0.113614708],
	[-0.000365296938, -0.00412161469, 0.693511405],
];

const SIMULATIONS: Record<Vision, Matrix> = {
	protanopia: [
		[0, 2.02344, -2.52581],
		[0, 1, 0],
		[0, 0, 1],
	],
	deuteranopia: [
		[1, 0, 0],
		[0.494207, 0, 1.24827],
		[0, 0, 1],
	],
	tritanopia: [
		[1, 0, 0],
		[0, 1, 0],
		[-0.395913, 0.801109, 0],
	],
};

const ERROR_SHIFT: Matrix = [
	[0, 0, 0],
	[0.7, 1, 0],
	[0.7, 0, 1],
];

function multiply(matrix: Matrix, [a, b, c]: Vector): Vector {
	return matrix.map(([x, y, z]) => x * a + y * b + z * c) as Vector;
}

function clampByte(value: number): number {
	return Math.min(255, Math.max(0, Math.round(value)));
}

/**
 * @description Moves an RGB color toward one a person with the given color blindness can tell apart, by simulating
 * what they see and shifting the lost difference into channels they still perceive.
 * @param rgb The red, green and blue channels, 0 to 255.
 * @param vision The kind of color blindness.
 * @param strength How far to move the color, from 0 (unchanged) to 1.
 * @returns The adjusted channels.
 */
export function daltonize(rgb: Vector, vision: Vision, strength = 1): Vector {
	const seen = multiply(LMS_TO_RGB, multiply(SIMULATIONS[vision], multiply(RGB_TO_LMS, rgb)));
	const lost = rgb.map((channel, index) => channel - seen[index]!) as Vector;
	const shift = multiply(ERROR_SHIFT, lost);

	return rgb.map((channel, index) => clampByte(channel + shift[index]! * strength)) as Vector;
}

/**
 * @description Adjusts a color packed as an ARGB integer, keeping its alpha.
 * @param argb The color, as Discord's native rows carry it.
 * @param vision The kind of color blindness.
 * @param strength How far to move the color, from 0 to 1.
 * @returns The adjusted ARGB color as the signed 32-bit integer Discord's rows use.
 */
export function daltonizeArgb(argb: number, vision: Vision, strength = 1): number {
	const value = argb >>> 0;
	const [r, g, b] = daltonize(
		[(value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff],
		vision,
		strength,
	);

	return (value & 0xff000000) | (r << 16) | (g << 8) | b;
}

/**
 * @description Adjusts a `#rrggbb` color string.
 * @param hex The color, with or without the leading `#`.
 * @param vision The kind of color blindness.
 * @param strength How far to move the color, from 0 to 1.
 * @returns The adjusted `#rrggbb` color, or `undefined` when `hex` is not one.
 */
export function daltonizeHex(hex: string, vision: Vision, strength = 1): string | undefined {
	const match = /^#?([0-9a-f]{6})$/i.exec(hex);

	if (!match) return undefined;

	const rgb = Number.parseInt(match[1]!, 16);
	const adjusted = daltonizeArgb(0xff000000 | rgb, vision, strength) & 0xffffff;

	return `#${adjusted.toString(16).padStart(6, '0')}`;
}

export default { daltonize, daltonizeArgb, daltonizeHex };
