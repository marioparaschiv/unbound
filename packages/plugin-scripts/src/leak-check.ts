export const LEAK_THRESHOLD_MB_PER_CYCLE = 0.5;

const BYTES_PER_MB = 1_048_576;

/**
 * @description Collects garbage and reads Hermes' live heap, so the reading reflects what is retained rather than what is uncollected.
 * @returns A script whose result is the live heap in bytes, or `-1` when Hermes exposes no statistics.
 */
export function liveHeapScript(): string {
	return `(function () {
	if (typeof gc === 'function') gc();
	var stats = typeof HermesInternal !== 'undefined' && HermesInternal.getInstrumentedStats ? HermesInternal.getInstrumentedStats() : null;
	return String(stats ? stats.js_allocatedBytes : -1);
})()`;
}

/**
 * @description Works out how much the live heap grew per cycle.
 * @param beforeBytes The live heap before the measured cycles.
 * @param afterBytes The live heap after them.
 * @param cycles How many cycles ran in between.
 * @returns Megabytes per cycle, rounded to two places, or `undefined` without both readings.
 */
export function growthPerCycle(
	beforeBytes: number,
	afterBytes: number,
	cycles: number,
): number | undefined {
	if (beforeBytes < 0 || afterBytes < 0 || cycles <= 0) return undefined;

	return Math.round(((afterBytes - beforeBytes) / BYTES_PER_MB / cycles) * 100) / 100;
}

/**
 * @description Describes a plugin whose live heap keeps growing, or returns nothing when it stays within the threshold.
 * @param perCycleMB Growth per cycle.
 * @param cycles How many cycles were measured.
 * @returns The failure note, or `undefined` when the plugin passes.
 */
export function leakNote(perCycleMB: number | undefined, cycles: number): string | undefined {
	if (perCycleMB === undefined || perCycleMB <= LEAK_THRESHOLD_MB_PER_CYCLE) return undefined;

	return `the live JS heap grew ${perCycleMB} MB per cycle over ${cycles} cycles`;
}
