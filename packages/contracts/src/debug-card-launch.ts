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
		launch.lastCheck?.outcome === 'failed' && 'update check failed',
		launch.settings && `settings ${launch.settings}`,
		(launch.firstRenderMs ?? 0) > SLOW_FIRST_RENDER_MS &&
			`first screen ${((launch.firstRenderMs ?? 0) / 1000).toFixed(1)} s`,
	];

	return [...notes, ...systemNotes(launch.system)].filter(
		(note): note is string => typeof note === 'string',
	);
}

function counted(count: number | undefined, one: string, many: string): string | undefined {
	return count ? `${count} ${count === 1 ? one : many}` : undefined;
}

/**
 * @description Lists the exits the system forced over the last week, most severe first.
 * @param system The counts from MetricKit on iOS or exit reasons on Android.
 * @returns The notes; empty when the system killed nothing.
 */
export function systemNotes(system?: DebugCardLaunch['system']): string[] {
	if (!system) {
		return [];
	}

	const longest = system.longestHangMs
		? ` (longest ${(system.longestHangMs / 1000).toFixed(1)} s)`
		: '';
	const hangs = counted(system.hangs, 'hang', 'hangs');
	const notes = [
		counted(system.memory, 'out-of-memory kill', 'out-of-memory kills'),
		counted(system.watchdog, 'watchdog kill', 'watchdog kills'),
		counted(system.cpu, 'CPU limit kill', 'CPU limit kills'),
		counted(system.lockedFile, 'locked-file kill', 'locked-file kills'),
		hangs && `${hangs}${longest}`,
	];

	return notes
		.filter((note): note is string => typeof note === 'string')
		.map((note) => `${note} this week`);
}

export default launchNotes;
