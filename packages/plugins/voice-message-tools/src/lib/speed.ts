/**
 * @description Reads the speed setting.
 * @param value The stored speed.
 * @returns The speed, 1 for anything unknown.
 */
export function parseSpeed(value: string): number {
	const speed = Number(value);

	return Number.isFinite(speed) && speed >= 0.5 && speed <= 3 ? speed : 1;
}
