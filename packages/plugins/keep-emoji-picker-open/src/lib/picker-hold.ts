export const PICKER_KEY = 'EmojiPickerActionSheet';

export type PickerHold = {
	hold: () => void;
	holds: (key?: string) => boolean;
};

/**
 * @description Tracks the moment after an emoji pick, when Discord closes the picker on its own.
 * @param windowMs How long after a pick the picker's own close calls are ignored.
 * @param now The clock, in milliseconds.
 * @returns `hold` to call on each pick, and `holds` to ask whether a close of the given sheet key falls in that moment.
 */
export function createPickerHold(windowMs: number, now: () => number = Date.now): PickerHold {
	let heldUntil = 0;

	return {
		hold: () => {
			heldUntil = now() + windowMs;
		},
		holds: (key) => now() < heldUntil && (key === undefined || key === PICKER_KEY),
	};
}
