/**
 * @description Reads a clock that never goes backwards, falling back to `Date.now()` where `performance` is missing.
 * @returns The time in milliseconds.
 */
export function monotonicNow(): number {
	return globalThis.performance?.now?.() ?? Date.now();
}
