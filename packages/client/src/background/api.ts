import type { BackgroundJob, BackgroundRun, BackgroundStatus } from '@unbound-app/types/background';

import {
	addBackgroundJob,
	backgroundJobs,
	DEFAULT_PHASE,
	lastBackgroundRun,
	runBackgroundJobs,
} from '~/background/jobs';
import { getBackgroundRefresh } from '~/native/unbound-native';

export type * from '@unbound-app/types/background';

/**
 * @description Adds a job to every background refresh, which runs it while Discord is in the background with the other
 * jobs, a time limit and its own error log. A plugin's jobs are removed when it stops.
 * @param name The job's name, shown in `ubd debug background`.
 * @param job The work; a rejected promise or thrown error only fails this job.
 * @param owner Who added it; a plugin's scope fills in its id.
 * @returns A function that removes the job.
 */
export function add(name: string, job: BackgroundJob, owner = 'unbound'): () => void {
	return addBackgroundJob({ name, owner, run: job, phase: DEFAULT_PHASE });
}

/**
 * @description Runs every background job now, in the foreground, for checking them.
 * @returns How each job went.
 */
export function run(): Promise<BackgroundRun> {
	return runBackgroundJobs('manual');
}

/**
 * @description Reads the registered jobs, the last run and the loader's spacing of refreshes.
 * @returns The status.
 */
export function status(): BackgroundStatus {
	const gate = getBackgroundRefresh();

	return {
		jobs: backgroundJobs(),
		...(lastBackgroundRun() ? { lastRun: lastBackgroundRun() } : {}),
		...(gate ? { gate } : {}),
	};
}

export default { add, run, status };
