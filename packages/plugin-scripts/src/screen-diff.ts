import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const SCREEN_CHANGE_RATIO = 0.005;
const STATUS_BAR_CROP = '100%x92%+0+0';

/**
 * @description Reads the share of pixels ImageMagick's `compare -metric AE` found different, from what it printed.
 * @param output What the command printed, such as `441 (0.049)`.
 * @returns The share from 0 to 1, or `undefined` when the output has none.
 */
export function differenceRatio(output: string): number | undefined {
	const match = /\(([\d.e-]+)\)/.exec(output);
	const ratio = match ? Number(match[1]) : Number.NaN;

	return Number.isFinite(ratio) ? ratio : undefined;
}

/**
 * @description Describes how a screen changed since the last run, when the change is large enough to look at.
 * @param name What the screen is, such as `unbound.chat-bubbles settings`.
 * @param ratio The share of pixels that differ.
 * @returns The change, or `undefined` for a screen that looks the same.
 */
export function describeScreenChange(name: string, ratio: number | undefined): string | undefined {
	if (ratio === undefined || ratio < SCREEN_CHANGE_RATIO) return;

	return `${name} screen looks different from the last run (${(ratio * 100).toFixed(1)}% of pixels)`;
}

/**
 * @description Keeps the screenshot from the last run beside the new one, so the two can be compared.
 * @param file The screenshot about to be replaced.
 * @returns Where the earlier screenshot was kept, or `undefined` when there was none.
 */
export function keepPrevious(file: string): string | undefined {
	if (!existsSync(file)) return;

	const previous = join(dirname(file), 'previous', basename(file));

	mkdirSync(dirname(previous), { recursive: true });
	copyFileSync(file, previous);

	return previous;
}

/**
 * @description Picks the screenshot to compare a new one with: the one from the last run that passed everywhere, or else the one from the last run.
 * @param file The screenshot about to be replaced.
 * @returns The reference screenshot, or `undefined` when there is none.
 */
export function referenceFor(file: string): string | undefined {
	const previous = keepPrevious(file);
	const good = join(dirname(file), 'good', basename(file));

	return existsSync(good) ? good : previous;
}

/**
 * @description Keeps the screenshots of a run that passed everywhere as the reference for later runs.
 * @param out The output directory.
 * @param suffix Which screenshots to keep, such as `.settings.png`.
 * @returns How many screenshots were kept.
 */
export function keepGoodScreens(out: string, suffix: string): number {
	const good = join(out, 'good');
	const files = readdirSync(out).filter((name) => name.endsWith(suffix));

	mkdirSync(good, { recursive: true });

	for (const name of files) copyFileSync(join(out, name), join(good, name));

	return files.length;
}

/**
 * @description Measures how much of a screen changed between two screenshots, below the status bar, using ImageMagick.
 * @param previous The earlier screenshot.
 * @param current The new screenshot.
 * @returns The share of pixels that differ, or `undefined` when ImageMagick is missing or the images cannot be compared.
 */
export async function screenDifference(
	previous: string,
	current: string,
): Promise<number | undefined> {
	const crop = (file: string) => [
		'(',
		file,
		'-gravity',
		'south',
		'-crop',
		STATUS_BAR_CROP,
		'+repage',
		')',
	];

	try {
		const child = Bun.spawn(
			[
				'magick',
				'compare',
				'-metric',
				'AE',
				'-fuzz',
				'10%',
				...crop(previous),
				...crop(current),
				'null:',
			],
			{ stdout: 'pipe', stderr: 'pipe' },
		);
		const [stderr] = await Promise.all([new Response(child.stderr).text(), child.exited]);

		return differenceRatio(stderr);
	} catch {
		return;
	}
}
