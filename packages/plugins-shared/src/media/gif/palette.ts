export type Palette = {
	colors: Uint8Array;
	size: number;
	lookup: (red: number, green: number, blue: number) => number;
};

type Box = { indices: number[]; count: number };

const BINS = 32 * 32 * 32;
const SAMPLE_STEP = 2;
const OPAQUE = 128;

function bin(red: number, green: number, blue: number): number {
	return ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
}

function channel(index: number, shift: number): number {
	return ((index >> shift) & 31) * 8 + 4;
}

function histogramOf(frames: Uint8Array[]): Uint32Array {
	const histogram = new Uint32Array(BINS);

	for (const frame of frames) {
		for (let offset = 0; offset < frame.length; offset += 4 * SAMPLE_STEP) {
			if (frame[offset + 3]! < OPAQUE) continue;

			histogram[bin(frame[offset]!, frame[offset + 1]!, frame[offset + 2]!)]! += 1;
		}
	}

	return histogram;
}

function widestChannel(indices: number[]): number {
	let widest = 0;
	let range = -1;

	for (const shift of [10, 5, 0]) {
		let low = 31;
		let high = 0;

		for (const index of indices) {
			const value = (index >> shift) & 31;

			low = Math.min(low, value);
			high = Math.max(high, value);
		}

		if (high - low > range) {
			range = high - low;
			widest = shift;
		}
	}

	return widest;
}

function split(box: Box, histogram: Uint32Array): [Box, Box] {
	const shift = widestChannel(box.indices);
	const sorted = [...box.indices].sort((a, b) => ((a >> shift) & 31) - ((b >> shift) & 31));
	let seen = 0;
	let cut = 1;

	for (; cut < sorted.length - 1; cut++) {
		seen += histogram[sorted[cut - 1]!]!;

		if (seen >= box.count / 2) break;
	}

	const first = sorted.slice(0, cut);
	const second = sorted.slice(cut);
	const total = (indices: number[]) => indices.reduce((sum, index) => sum + histogram[index]!, 0);

	return [
		{ indices: first, count: total(first) },
		{ indices: second, count: total(second) },
	];
}

function average(box: Box, histogram: Uint32Array): [number, number, number] {
	let red = 0;
	let green = 0;
	let blue = 0;

	for (const index of box.indices) {
		const weight = histogram[index]!;

		red += channel(index, 10) * weight;
		green += channel(index, 5) * weight;
		blue += channel(index, 0) * weight;
	}

	return [
		Math.round(red / box.count),
		Math.round(green / box.count),
		Math.round(blue / box.count),
	];
}

/**
 * @description Builds one palette of up to 256 colours for a set of RGBA frames by median cut over a 15-bit
 * histogram, so every frame of the GIF shares it and colours don't flicker between frames. Mostly transparent pixels
 * are left out.
 * @param frames The frames' RGBA bytes.
 * @param maxColors How many colours the palette may hold, at most 256.
 * @returns The palette and a lookup from a colour to its nearest palette entry.
 */
export function buildPalette(frames: Uint8Array[], maxColors = 256): Palette {
	const histogram = histogramOf(frames);
	const used: number[] = [];

	for (let index = 0; index < BINS; index++) if (histogram[index]) used.push(index);

	let boxes: Box[] = [
		{
			indices: used,
			count: used.reduce((sum, index) => sum + histogram[index]!, 0),
		},
	];

	while (boxes.length < maxColors) {
		const candidate = boxes
			.filter((box) => box.indices.length > 1)
			.sort((a, b) => b.count - a.count)[0];

		if (!candidate) break;

		boxes = [...boxes.filter((box) => box !== candidate), ...split(candidate, histogram)];
	}

	const colors = new Uint8Array(256 * 3);
	const means = boxes.filter((box) => box.count > 0).map((box) => average(box, histogram));

	means.forEach(([red, green, blue], index) => colors.set([red, green, blue], index * 3));

	const nearest = new Int16Array(BINS).fill(-1);

	return {
		colors,
		size: Math.max(means.length, 2),
		lookup(red, green, blue) {
			const key = bin(red, green, blue);
			const cached = nearest[key]!;

			if (cached >= 0) return cached;

			let best = 0;
			let distance = Number.POSITIVE_INFINITY;

			means.forEach(([r, g, b], index) => {
				const d = (r - red) ** 2 + (g - green) ** 2 + (b - blue) ** 2;

				if (d < distance) {
					distance = d;
					best = index;
				}
			});

			nearest[key] = best;

			return best;
		},
	};
}

export default { buildPalette };
