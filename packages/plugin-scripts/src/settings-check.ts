import type { MeasuredCheck } from './compare-device-matrix';
import type { SettingsProbe } from './device-scripts';

/**
 * @description Says what is wrong with a plugin's settings screen from what the matrix's probe recorded.
 * @param probe Whether the panel rendered, how much text it showed and the error it threw.
 * @returns The problem, or `undefined` when the screen rendered some text without an error.
 */
export function settingsFailure(probe: SettingsProbe): string | undefined {
	if (probe.error) return `the settings screen threw: ${probe.error}`;
	if (!probe.rendered) return 'the settings screen did not render';
	if (probe.texts === 0) return 'the settings screen is empty';
}

/**
 * @description Records a plugin's settings screen on its check, failing the check when the screen is broken.
 * @param check The plugin's check.
 * @param file The screenshot of the screen, when one was taken.
 * @param probe What the probe recorded on the screen.
 * @returns The updated check.
 */
export function withSettings(
	check: MeasuredCheck,
	file: string | undefined,
	probe: SettingsProbe,
): MeasuredCheck {
	const failure = settingsFailure(probe);
	const evidence = [
		...check.evidence,
		`settings: ${probe.texts} texts${file ? `, ${file}` : ''}`,
	];

	if (!failure) return { ...check, evidence };

	return {
		...check,
		behavior: 'fail',
		evidence,
		note: [check.note, failure].filter(Boolean).join('; '),
	};
}
