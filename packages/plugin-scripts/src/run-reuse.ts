import type { MeasuredCheck } from './compare-device-matrix';

function sameBundle(
	id: string,
	bundleHash: string | undefined,
	previous: MeasuredCheck[] | undefined,
): MeasuredCheck | undefined {
	if (!bundleHash) return;

	const earlier = previous?.find((candidate) => candidate.id === id);

	return earlier?.bundleHash === bundleHash ? earlier : undefined;
}

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
	return sameBundle(check.id, check.bundleHash, previous)?.leakPerCycleMB;
}

/**
 * @description Finds the settings check a plugin can keep from the last run: one that passed on the same bundle.
 * @param id The plugin's id.
 * @param bundleHash The hash of the bundle it runs now.
 * @param previous The checks from the last run.
 * @returns The last run's settings evidence, or `undefined` when the screen must be checked again.
 */
export function reusableSettings(
	id: string,
	bundleHash: string | undefined,
	previous: MeasuredCheck[] | undefined,
): string | undefined {
	const earlier = sameBundle(id, bundleHash, previous);

	if (!earlier || earlier.visualProblems?.length) return;

	return earlier.evidence.find((entry) => entry.startsWith('settings: '));
}
