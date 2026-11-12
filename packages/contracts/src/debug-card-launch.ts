import type { DebugCardLaunch } from './debug-cards';

export const SLOW_FIRST_RENDER_MS = 5_000;

/**
 * @description Lists what needs attention about a launch, the most telling first: a native crash, a fallback bundle, Recovery Mode, early closes.
 * @param launch The loader's launch report, missing on loaders older than 1.3.0.
 * @returns The notes; empty when the launch is unremarkable.
 */
export function launchNotes(launch?: DebugCardLaunch): string[] {
	if (!launch) {
		return [];
	}

	const closes = launch.earlyCloses;
	const notes = [
		!launch.crashes?.length &&
			(launch.lastCrash
				? `crash ${launch.lastCrash}`
				: launch.previousExit === 'crashed' && 'previous launch crashed'),
		launch.bundle !== 'active' && `bundle ${launch.bundle}`,
		launch.recovery && 'recovery mode',
		closes > 0 && `${closes} early ${closes === 1 ? 'close' : 'closes'}`,
		(launch.firstRenderMs ?? 0) > SLOW_FIRST_RENDER_MS &&
			`first screen ${((launch.firstRenderMs ?? 0) / 1000).toFixed(1)} s`,
	];

	return notes.filter((note): note is string => typeof note === 'string');
}

export default launchNotes;
