const UNCHANGED = 0;
const UPDATED = 1;

/**
 * @description Reads the change type a rebuilt row gets while a redraw is forced: rows Discord would skip are redrawn.
 * @param changeType The type Discord chose; `0` leaves the row on screen untouched.
 * @returns The type to send.
 */
export function forcedChangeType(changeType: number): number {
	return changeType === UNCHANGED ? UPDATED : changeType;
}
