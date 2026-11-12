export type ReuseSettle = { placed: boolean; dirty: boolean };

/**
 * @description Starts tracking a reused cell while its new message settles.
 * @returns A record that has not been placed and is not dirty.
 */
export function startSettle(): ReuseSettle {
	return { placed: false, dirty: false };
}

/**
 * @description Records that the cell was placed, which covers every change made before it.
 * @param settle The cell's settle record, if it is still settling.
 */
export function notePlaced(settle: ReuseSettle | undefined): void {
	if (!settle) return;

	settle.placed = true;
	settle.dirty = false;
}

/**
 * @description Records a change to a cell, marking it dirty when it was already placed.
 * @param settle The cell's settle record, if it is still settling.
 * @returns Whether the caller should place the cell now, which is when it is not settling.
 */
export function noteChange(settle: ReuseSettle | undefined): boolean {
	if (!settle) return true;

	if (settle.placed) settle.dirty = true;

	return false;
}

/**
 * @description Decides whether the settle pass needs to place the cell again.
 * @param settle The cell's settle record.
 * @returns Whether the cell was never placed or changed after its last place.
 */
export function needsSettle(settle: ReuseSettle): boolean {
	return !settle.placed || settle.dirty;
}

/**
 * @description Remembers what each bubble was last drawn with, so an identical redraw can be skipped.
 * @returns `changed`, which records a drawing and reports whether it differs, plus `forget` and `clear`.
 */
export function createDrawnSignatures() {
	const signatures = new Map<string, string>();

	return {
		changed(key: string, drawn: object): boolean {
			const signature = JSON.stringify(drawn);

			if (signatures.get(key) === signature) return false;

			signatures.set(key, signature);

			return true;
		},
		forget: (key: string) => void signatures.delete(key),
		clear: () => signatures.clear(),
	};
}
