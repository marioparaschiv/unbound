const TOLERANCE = 42;
const PLAIN_BORDER = 0.6;
const MIN_CLEARED = 0.03;
const MAX_CLEARED = 0.97;

type Color = [number, number, number];

function colorAt(pixels: Uint8Array, index: number): Color {
	const offset = index * 4;

	return [pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!];
}

function distance(a: Color, b: Color): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function borderIndexes(width: number, height: number): number[] {
	const indexes: number[] = [];

	for (let x = 0; x < width; x++) indexes.push(x, (height - 1) * width + x);
	for (let y = 1; y < height - 1; y++) indexes.push(y * width, y * width + width - 1);

	return indexes;
}

function averageColor(pixels: Uint8Array, indexes: number[]): Color {
	const sum = [0, 0, 0];

	for (const index of indexes) {
		const [r, g, b] = colorAt(pixels, index);

		sum[0] += r;
		sum[1] += g;
		sum[2] += b;
	}

	return sum.map((value) => value / indexes.length) as Color;
}

function floodFrom(
	pixels: Uint8Array,
	width: number,
	height: number,
	seeds: number[],
	background: Color,
) {
	const cleared = new Uint8Array(width * height);
	const queue = seeds.filter((index) => distance(colorAt(pixels, index), background) < TOLERANCE);

	for (const index of queue) cleared[index] = 1;

	for (let head = 0; head < queue.length; head++) {
		const index = queue[head]!;
		const x = index % width;
		const neighbours = [
			x > 0 ? index - 1 : -1,
			x < width - 1 ? index + 1 : -1,
			index - width,
			index + width,
		];

		for (const next of neighbours) {
			if (next < 0 || next >= cleared.length || cleared[next]) continue;
			if (distance(colorAt(pixels, next), background) >= TOLERANCE) continue;

			cleared[next] = 1;
			queue.push(next);
		}
	}

	return { cleared, count: queue.length };
}

function edgeAlpha(pixels: Uint8Array, index: number, background: Color): number {
	const closeness = (distance(colorAt(pixels, index), background) - TOLERANCE) / TOLERANCE;

	return Math.round(255 * Math.min(1, Math.max(0.35, closeness)));
}

function touchesCleared(cleared: Uint8Array, width: number, index: number): boolean {
	const x = index % width;

	return Boolean(
		(x > 0 && cleared[index - 1]) ||
		(x < width - 1 && cleared[index + 1]) ||
		cleared[index - width] ||
		cleared[index + width],
	);
}

/**
 * @description Cuts a subject out of a plain background by filling inward from the image's edges through pixels
 * close to the edge colour, so background-coloured areas inside the subject stay. Pixels along the cut get softened.
 * @param pixels The image's RGBA bytes.
 * @param width The image's width.
 * @param height The image's height.
 * @returns New RGBA bytes with the background transparent, or `undefined` when the edges aren't one plain colour or
 * nothing sensible was cut.
 */
export function clearPlainBackground(
	pixels: Uint8Array,
	width: number,
	height: number,
): Uint8Array | undefined {
	const border = borderIndexes(width, height);
	const background = averageColor(pixels, border);
	const plain = border.filter(
		(index) => distance(colorAt(pixels, index), background) < TOLERANCE,
	);

	if (plain.length < border.length * PLAIN_BORDER) return undefined;

	const { cleared, count } = floodFrom(pixels, width, height, plain, background);
	const share = count / (width * height);

	if (share < MIN_CLEARED || share > MAX_CLEARED) return undefined;

	const result = Uint8Array.from(pixels);

	for (let index = 0; index < cleared.length; index++) {
		if (cleared[index]) result[index * 4 + 3] = 0;
		else if (touchesCleared(cleared, width, index))
			result[index * 4 + 3] = edgeAlpha(pixels, index, background);
	}

	return result;
}

export default { clearPlainBackground };
