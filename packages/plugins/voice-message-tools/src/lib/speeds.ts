/** The speeds the speed row steps through, as the speed setting stores them. */
// Whole speeds keep a `.0`: an integer-like key would jump ahead of the others in the settings' segmented control.
export const SPEEDS = ['1.0', '1.5', '2.0', '0.75'] as const;

/** A speed as the speed setting stores it. */
export type StoredSpeed = (typeof SPEEDS)[number];

/**
 * @description Finds the stored form of a speed, so `1` saved by 1.6.0 and earlier reads as `1.0`.
 * @param value The saved speed.
 * @returns The stored speed with the same value, or `undefined` for anything else.
 */
export function storedSpeedFor(value: unknown): StoredSpeed | undefined {
	return typeof value === 'string'
		? SPEEDS.find((speed) => Number(speed) === Number(value))
		: undefined;
}

/**
 * @description Picks the speed after the current one, back to the first after the last.
 * @param current The stored speed.
 * @returns The next stored speed.
 */
export function nextSpeed(current: string): StoredSpeed {
	const index = SPEEDS.findIndex((speed) => speed === storedSpeedFor(current));

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
