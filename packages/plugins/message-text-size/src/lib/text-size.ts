const MIN_PERCENT = 50;
const MAX_PERCENT = 200;
const SAME_SIZE = 0.01;

/** A message's remembered size: Discord's own, and the size the plugin last gave it. */
export type RememberedSize = { base: number; applied: number };

/**
 * @description Turns the setting into a factor, keeping it in the slider's range.
 * @param percent The size in percent of Discord's.
 * @returns The factor, such as 1.15.
 */
export function scaleOf(percent: number): number {
	'worklet';

	return Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, percent || 100)) / 100;
}

/**
 * @description Works out Discord's own size for a message's text: the remembered one while the text still has the size
 * the plugin gave it, or the current one once Discord has set a size of its own.
 * @param current The text's size now, in pixels.
 * @param remembered What the plugin remembered for this view, if anything.
 * @returns Discord's size, in pixels.
 */
export function baseSize(current: number, remembered: RememberedSize | undefined): number {
	'worklet';

	return remembered && Math.abs(current - remembered.applied) < SAME_SIZE
		? remembered.base
		: current;
}
