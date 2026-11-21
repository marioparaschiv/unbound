import type { BackgroundStatus } from '@unbound-app/types/background';

function duration(ms: number): string {
	if (ms < 1_000) {
		return `${Math.round(ms)} ms`;
	}

	if (ms < 60_000) {
		return `${(ms / 1_000).toFixed(1)} s`;
	}

	return `${Math.round(ms / 60_000)} min`;
}

function gateLine(gate: NonNullable<BackgroundStatus['gate']>): string {
	const state = gate.running ? 'running now' : 'idle';
	const next =
		gate.dueInMs > 0 ? `due in ${duration(gate.dueInMs)}` : 'due at the next backgrounding';

	return `Loader: ${gate.runs} run${gate.runs === 1 ? '' : 's'} this launch, last ${duration(gate.sinceLastMs)} ago, ${next}, ${state}.`;
}

/**
 * @description Formats the background refresh status for the terminal: the loader's gate, the jobs and the last run.
 * @param status The status from the device.
 * @param now The device clock, for the last run's age.
 * @returns The lines.
 */
export function formatBackground(status: BackgroundStatus, now: number): string {
	const lines = [
		status.gate
			? gateLine(status.gate)
			: 'Loader: no background refresh (a loader from before it).',
		...(status.gate?.scheduled ? [`Scheduled refresh: ${status.gate.scheduled}.`] : []),
		`Jobs: ${status.jobs.map((job) => (job.owner === 'unbound' ? job.name : `${job.name} (${job.owner})`)).join(', ') || 'none'}.`,
	];
	const run = status.lastRun;

	if (!run) {
		lines.push('Last run: none yet this launch.');

		return lines.join('\n');
	}

	lines.push(
		`Last run: ${run.trigger}, ${duration(now - run.startedAt)} ago, took ${duration(run.durationMs)}.`,
	);

	for (const job of run.jobs) {
		const reason = job.ok ? job.skipped : job.error;
		const mark = !job.ok ? 'FAIL' : job.skipped ? 'skip' : 'ok  ';
		const error = reason ? `: ${reason}` : '';

		lines.push(`  ${mark} ${job.name} (${job.owner}) ${duration(job.durationMs)}${error}`);
	}

	return lines.join('\n');
}

export default { formatBackground };
