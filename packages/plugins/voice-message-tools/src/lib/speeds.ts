/** The speeds the speed row steps through, as the speed setting stores them. */
export const SPEEDS = ['1', '1.5', '2', '0.75'] as const;

/** A speed as the speed setting stores it. */
export type StoredSpeed = (typeof SPEEDS)[number];

/**
 * @description Picks the speed after the current one, back to the first after the last.
 * @param current The stored speed.
 * @returns The next stored speed.
 */
export function nextSpeed(current: string): StoredSpeed {
	const index = SPEEDS.findIndex((speed) => speed === current);

	return SPEEDS[(index + 1) % SPEEDS.length]!;
}

/**
 * @description Writes a speed the way the speed row shows it.
 * @param speed The speed.
 * @returns The label, such as `1.5×`.
 */
export function speedLabel(speed: number): string {
	'worklet';

	return `${speed}×`;
}
