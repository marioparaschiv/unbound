import type { UnboundLaunchReport } from '@unbound-app/types';

/**
 * @description Lists what needs attention about this launch, the most telling first: a native crash, a fallback bundle, Recovery Mode, early closes.
 * @param launch The loader's launch report, missing on loaders older than 1.3.0.
 * @returns The notes; empty when the launch is unremarkable.
 */
export function launchNotes(launch?: UnboundLaunchReport): string[] {
	if (!launch) {
		return [];
	}

	const closes = launch.earlyCloses;
	const notes = [
		launch.lastCrash
			? `crash ${launch.lastCrash}`
			: launch.previousExit === 'crashed' && 'previous launch crashed',
		launch.bundle !== 'active' && `bundle ${launch.bundle}`,
		launch.recovery && 'recovery mode',
		closes > 0 && `${closes} early ${closes === 1 ? 'close' : 'closes'}`,
	];

	return notes.filter((note): note is string => typeof note === 'string');
}

export default launchNotes;
