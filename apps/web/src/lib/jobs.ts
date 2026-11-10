import { createLogger } from '@unbound-app/logger';

const logger = createLogger('Web', 'Jobs');

/** The background jobs a server process runs. */
export type JobName = 'staging' | 'sponsors' | 'team' | 'profiles';

/** A background job: `kick` asks for a run without waiting for it, `stop` ends it for good. */
export type Job = {
	kick(): void;
	stop(): void;
};

/** The process's running jobs, by name, so code that changes their input can ask for a run. */
export type Jobs = {
	/**
	 * Kicks a job now and every `seconds` after, stopping one already started under the name.
	 * Stopping the returned job clears its interval too.
	 */
	start(name: JobName, seconds: number, job: Job): Job;
	/** Asks a started job for a run without waiting; does nothing when none was started. */
	kick(name: JobName): void;
};

/**
 * @description Creates an empty job registry; a test context gets its own, so kicks never cross tests.
 * @returns The registry.
 */
export function createJobs(): Jobs {
	const started = new Map<JobName, Job>();

	return {
		start(name, seconds, job) {
			started.get(name)?.stop();

			const interval = setInterval(() => job.kick(), seconds * 1000);
			const handle: Job = {
				kick: () => job.kick(),
				stop() {
					clearInterval(interval);
					job.stop();

					if (started.get(name) === handle) {
						started.delete(name);
					}
				},
			};

			started.set(name, handle);
			handle.kick();

			return handle;
		},
		kick(name) {
			started.get(name)?.kick();
		},
	};
}

/**
 * @description Runs `run` at once and every `seconds` for the life of the process. A kick while a run
 * is still going is dropped, so a slow run is never overlapped; a failed run is logged and retried on
 * the next tick.
 * @param jobs The registry to start it in.
 * @param name The job's name.
 * @param seconds The interval between runs.
 * @param run One run of the job.
 * @returns The started job.
 */
export function startPeriodicJob(
	jobs: Jobs,
	name: JobName,
	seconds: number,
	run: () => Promise<void>,
): Job {
	let running = false;
	let stopped = false;

	async function attempt() {
		if (running || stopped) return;

		running = true;

		try {
			await run();
		} catch (error) {
			logger.error(`Failed to run the ${name} job:`, error);
		} finally {
			running = false;
		}
	}

	return jobs.start(name, seconds, {
		kick: () => void attempt(),
		stop() {
			stopped = true;
		},
	});
}

export default { createJobs, startPeriodicJob };
