import type { MeasuredCheck } from './compare-device-matrix';

/**
 * @description Finds the leak result a plugin can keep from the last run: one measured on the same bundle.
 * @param check The plugin's check from this run.
 * @param previous The checks from the last run.
 * @returns The last run's growth per cycle, or `undefined` when the plugin changed or was not measured.
 */
export function reusableLeak(
	check: MeasuredCheck,
	previous: MeasuredCheck[] | undefined,
): number | undefined {
	if (!check.bundleHash) return;

	const earlier = previous?.find((candidate) => candidate.id === check.id);

	if (earlier?.bundleHash !== check.bundleHash) return;

	return earlier.leakPerCycleMB;
}
