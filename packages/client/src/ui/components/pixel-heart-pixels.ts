/** A pixel-art heart, one string per row: `o` outline, `b` body, `h` highlight, `s` shade, `w` glint. */
const ROWS = [
	'..ooo...ooo..',
	'.ohhbo.obbbo.',
	'ohwhbbobbbbso',
	'ohhbbbbbbbbso',
	'obbbbbbbbbbso',
	'.obbbbbbbbso.',
	'..obbbbbbso..',
	'...obbbbso...',
	'....obbso....',
	'.....oso.....',
	'......o......',
];

/** The pastel reds each pixel kind is drawn in. */
const COLORS: Record<string, string> = {
	o: '#C9485F',
	b: '#FF8FA3',
	h: '#FFC2CD',
	s: '#E86A82',
	w: '#FFFFFF',
};

/** One filled pixel of the heart, in grid units. */
export type HeartPixel = { x: number; y: number; color: string };

/** The heart's width and height in pixels. */
export const HEART_COLUMNS = ROWS[0]?.length ?? 0;
export const HEART_ROWS = ROWS.length;

/** Every filled pixel of the heart, read once from {@link ROWS}. */
export const HEART_PIXELS: HeartPixel[] = ROWS.flatMap((row, y) =>
	row.split('').flatMap((kind, x) => {
		const color = COLORS[kind];

		return color ? [{ x, y, color }] : [];
	}),
);

/** How bright the heart's side walls are against its face, as Minecraft shades an extruded item's sides. */
const SIDE_SHADE = 0.7;

function shade(color: string): string {
	const channels = [1, 3, 5].map((start) =>
		Math.round(Number.parseInt(color.slice(start, start + 2), 16) * SIDE_SHADE)
			.toString(16)
			.padStart(2, '0'),
	);

	return `#${channels.join('')}`;
}

/** The heart's pixels in their side-wall colours: each edge pixel's own colour, darkened. */
export const HEART_SIDE_PIXELS: HeartPixel[] = HEART_PIXELS.map((pixel) => ({
	...pixel,
	color: shade(pixel.color),
}));

/** The heart seen exactly side-on: per row, the side-wall colour of its outermost pixel. */
export const HEART_EDGE: HeartPixel[] = Array.from({ length: HEART_ROWS }, (_, y) =>
	HEART_SIDE_PIXELS.filter((pixel) => pixel.y === y).at(-1),
).filter((pixel): pixel is HeartPixel => Boolean(pixel));

export default { HEART_COLUMNS, HEART_ROWS, HEART_PIXELS, HEART_SIDE_PIXELS, HEART_EDGE };
