import type { CssVariables } from '~/lib/css-variables';

/** How strongly an element enters: the hero and its showcase are one-off moments, headings and cards are seen often. */
export type RevealPreset = 'hero' | 'showcase' | 'heading' | 'card';

type RevealTiming = {
	duration: number;
	blur: number;
	offset: string;
	scale: number;
	opacity: number;
};

const PRESETS: Record<RevealPreset, RevealTiming> = {
	hero: { duration: 700, blur: 10, offset: '0.4em', scale: 1, opacity: 0 },
	// The showcase starts opaque but pushed down under the hero's fade, so it slides up out of it.
	showcase: { duration: 900, blur: 0, offset: '45%', scale: 1, opacity: 1 },
	heading: { duration: 350, blur: 4, offset: '0.2em', scale: 1, opacity: 0 },
	card: { duration: 300, blur: 0, offset: '12px', scale: 1, opacity: 0 },
};

const STAGGER_MS = 40;

// Past this many items the rest enter together, so a long grid never waits on its tail.
const STAGGER_CAP = 8;

/**
 * @description Builds the CSS variables the `animate-reveal` utility reads.
 * @param preset How far, how blurred, how scaled and how long the element enters.
 * @param delay Milliseconds to wait before it starts.
 * @returns Inline styles to spread onto an element with the `animate-reveal` class.
 */
export function revealStyle(preset: RevealPreset, delay: number = 0): CssVariables {
	const { duration, blur, offset, scale, opacity } = PRESETS[preset];

	return {
		'--reveal-duration': `${duration}ms`,
		'--reveal-blur': `${blur}px`,
		'--reveal-offset': offset,
		'--reveal-scale': scale,
		'--reveal-opacity': opacity,
		'--reveal-delay': `${delay}ms`,
	};
}

/**
 * @description Staggers one item of a list that enters together, capped so long lists stay quick.
 * @param index The item's position among the items entering with it.
 * @param preset How the item enters.
 * @returns Inline styles to spread onto an element with the `animate-reveal` class.
 */
export function staggerStyle(index: number, preset: RevealPreset = 'card'): CssVariables {
	return revealStyle(preset, Math.min(index, STAGGER_CAP) * STAGGER_MS);
}

export default { revealStyle, staggerStyle };
