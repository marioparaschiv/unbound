export type PhaseTimings = { phases: Record<string, number>; totalMs: number };

/**
 * @description Formats a duration the way the matrix summary shows it.
 * @param milliseconds The duration.
 * @returns `850 ms`, `42 s` or `4 m 12 s`.
 */
export function formatDuration(milliseconds: number): string {
	if (milliseconds < 1_000) return `${Math.round(milliseconds)} ms`;

	const seconds = Math.round(milliseconds / 1_000);

	return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} m ${seconds % 60} s`;
}

/**
 * @description Times consecutive phases of a run.
 * @param now Reads the current time, replaceable in tests.
 * @returns `lap` ends the current phase under a name, and `result` returns every phase and the total.
 */
export function createTimings(now: () => number = Date.now) {
	const started = now();
	const phases: Record<string, number> = {};
	let mark = started;

	return {
		lap(name: string) {
			const current = now();

			phases[name] = (phases[name] ?? 0) + current - mark;
			mark = current;
		},
		result(): PhaseTimings {
			return { phases: { ...phases }, totalMs: now() - started };
		},
	};
}

/**
 * @description Describes a run's duration with its phases.
 * @param timings The run's timings.
 * @returns A line such as `5 m 2 s (setup 9 s, self-test 21 s, plugin cycles 4 m 3 s)`.
 */
export function describeTimings(timings: PhaseTimings): string {
	const phases = Object.entries(timings.phases)
		.map(([name, milliseconds]) => `${name} ${formatDuration(milliseconds)}`)
		.join(', ');

	return phases
		? `${formatDuration(timings.totalMs)} (${phases})`
		: formatDuration(timings.totalMs);
}
