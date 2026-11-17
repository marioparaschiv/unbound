export type TimedFrame = { rgba: Uint8Array; width: number; height: number; atMs: number };

export type FlashWindow = { startMs: number; endMs: number; flashes: number };

export type FlashReport = {
	/** Whether some second holds more than three flashes over a large part of the picture. */
	flagged: boolean;
	/** The busiest second, when any flashing was found. */
	worst?: FlashWindow;
	/** The picture's mean brightness per frame, from 0 to 1, for the timeline. */
	brightness: number[];
	/** Each frame's time, matching `brightness`. */
	times: number[];
};

const GRID = 4;
const LARGE_AREA_CELLS = 4;
const LUMINANCE_STEP = 0.1;
const DARK_LIMIT = 0.8;
const WINDOW_MS = 1000;
const FLASH_LIMIT = 3;

const LINEAR = Float64Array.from({ length: 256 }, (_, channel) => {
	const value = channel / 255;

	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
});

function luminance(r: number, g: number, b: number): number {
	return 0.2126 * LINEAR[r]! + 0.7152 * LINEAR[g]! + 0.0722 * LINEAR[b]!;
}

/**
 * @description Measures the relative luminance of each cell of a 4×4 grid over a frame, as WCAG defines luminance.
 * @param frame The frame.
 * @returns Sixteen luminances, row by row, from 0 to 1.
 */
export function cellLuminance({ rgba, width, height }: TimedFrame): number[] {
	const sums = new Float64Array(GRID * GRID);
	const counts = new Uint32Array(GRID * GRID);

	for (let y = 0; y < height; y++) {
		const row = Math.min(GRID - 1, Math.floor((y * GRID) / height));

		for (let x = 0; x < width; x++) {
			const cell = row * GRID + Math.min(GRID - 1, Math.floor((x * GRID) / width));
			const at = (y * width + x) * 4;

			sums[cell] += luminance(rgba[at]!, rgba[at + 1]!, rgba[at + 2]!);
			counts[cell]!++;
		}
	}

	return [...sums].map((sum, cell) => (counts[cell] ? sum / counts[cell]! : 0));
}

/**
 * @description Finds when one series of luminances flashes: a flash is a pair of opposing changes of at least 10%
 * where the darker side is below 0.8, the WCAG general flash definition.
 * @param series The luminances, in frame order.
 * @param times Each frame's time.
 * @returns The time of each flash's second transition.
 */
export function flashTimes(series: number[], times: number[]): number[] {
	const flashes: number[] = [];
	let anchor = series[0] ?? 0;
	let direction = 0;

	for (let index = 1; index < series.length; index++) {
		const value = series[index]!;
		const change = value - anchor;
		const darker = Math.min(value, anchor);

		if (Math.abs(change) >= LUMINANCE_STEP && darker < DARK_LIMIT) {
			const next = Math.sign(change);

			if (direction && next !== direction) flashes.push(times[index]!);

			direction = next;
			anchor = value;
		} else if ((direction > 0 && value > anchor) || (direction < 0 && value < anchor)) {
			anchor = value;
		}
	}

	return flashes;
}

function busiestWindow(flashes: number[]): FlashWindow | undefined {
	let best: FlashWindow | undefined;

	for (let start = 0; start < flashes.length; start++) {
		let end = start;

		while (end + 1 < flashes.length && flashes[end + 1]! - flashes[start]! < WINDOW_MS) end++;

		const count = end - start + 1;

		if (!best || count > best.flashes) {
			best = { startMs: flashes[start]!, endMs: flashes[end]!, flashes: count };
		}
	}

	return best;
}

/**
 * @description Checks frames for rapid flashing: each 4×4 cell is tracked on its own, and the media is flagged when
 * a quarter of the picture flashes more than three times within one second.
 * @param frames The frames, in time order.
 * @returns The verdict, the busiest second, and the brightness timeline.
 */
export function analyseFlashes(frames: TimedFrame[]): FlashReport {
	const cells = frames.map(cellLuminance);
	const times = frames.map(({ atMs }) => atMs);
	const windows = Array.from({ length: GRID * GRID }, (_, cell) =>
		busiestWindow(
			flashTimes(
				cells.map((values) => values[cell]!),
				times,
			),
		),
	)
		.filter((window): window is FlashWindow => Boolean(window))
		.sort((left, right) => right.flashes - left.flashes);
	const large = windows[LARGE_AREA_CELLS - 1];

	return {
		flagged: Boolean(large && large.flashes > FLASH_LIMIT),
		worst: windows[0],
		brightness: cells.map(
			(values) => values.reduce((total, value) => total + value, 0) / values.length,
		),
		times,
	};
}
