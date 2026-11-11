/** The width one icon takes in a marquee row: its round button plus the gap after it. */
export const SLOT_WIDTH = 72;

function mod(value: number, by: number): number {
	'worklet';

	return ((value % by) + by) % by;
}

/**
 * @description Places a marquee row's icons. A row holds a fixed set of slots that scroll left; a slot that leaves on
 * the left re-enters, off screen, on the right as the next icon in line. `progress` counts slot widths travelled.
 * @param slot The slot's index in the row.
 * @param slots How many slots the row has: enough to cover it plus spares off screen at each end.
 * @param step How many whole slot widths the row has travelled.
 * @returns The running position, in slots, of the icon the slot shows: index `n` is icon `n` modulo the icon count.
 */
export function iconAt(slot: number, slots: number, step: number): number {
	'worklet';

	return step - 1 + mod(slot - step + 1, slots);
}

/**
 * @description Picks the icon a slot shows.
 * @param slot The slot's index in the row.
 * @param slots How many slots the row has.
 * @param step How many whole slot widths the row has travelled.
 * @param count How many icons the row cycles through.
 * @returns The icon's index.
 */
export function iconIndex(slot: number, slots: number, step: number, count: number): number {
	return mod(iconAt(slot, slots, step), count);
}

/**
 * @description Finds a slot's offset from the row's left edge, in points, as the row scrolls.
 * @param slot The slot's index in the row.
 * @param slots How many slots the row has.
 * @param progress How far the row has travelled, in slot widths.
 * @returns The offset; between one and two slots left of the row for the slot about to re-enter on the right.
 */
export function slotOffset(slot: number, slots: number, progress: number): number {
	'worklet';

	return (iconAt(slot, slots, Math.floor(progress)) - progress) * SLOT_WIDTH;
}

/**
 * @description Counts the slots a row of a given width needs.
 * @param width The row's width, in points.
 * @returns Slots enough to fill it, one spare on the left, and two on the right so a re-entering slot has a full slot's
 * travel to swap its icon before it shows.
 */
export function slotsFor(width: number): number {
	return Math.ceil(width / SLOT_WIDTH) + 3;
}
