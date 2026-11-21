/** Work the background refresh runs while Discord is in the background. */
export type BackgroundJob = () => Promise<void> | void;

/** How a job runs. */
export type BackgroundJobOptions = {
	/** Skip the job unless Discord is on Wi-Fi or ethernet without Low Data Mode or Data Saver. */
	wifiOnly?: boolean;
	/** How long the job may take, at most the 20 s default. */
	timeoutMs?: number;
};

/** What every job result names. */
type BackgroundJobBase = {
	/** The job's name. */
	name: string;
	/** The plugin id that added it, or `unbound` for a built-in. */
	owner: string;
	/** How long it ran. */
	durationMs: number;
};

/** How one job went in a run: finished (or skipped, with why), or failed with what went wrong. */
export type BackgroundJobResult = BackgroundJobBase &
	(
		| {
				/** It finished without throwing or timing out, or was skipped. */
				ok: true;
				/** Why the job did not run, such as `not on Wi-Fi`. */
				skipped?: string;
		  }
		| {
				/** It threw or timed out. */
				ok: false;
				/** What failed. */
				error: string;
		  }
	);

/** One background refresh: what started it, when, and how each job went. */
export type BackgroundRun = {
	/** `loader` when Discord went to the background or the scheduled refresh fired; `manual` from `background.run()`. */
	trigger: 'loader' | 'manual';
	/** When it started, in milliseconds since the epoch. */
	startedAt: number;
	/** How long the whole run took. */
	durationMs: number;
	/** Each job's result, in the order they ran. */
	jobs: BackgroundJobResult[];
};

/** The loader's spacing of background refreshes. */
export type BackgroundGate = {
	/** Milliseconds since the last refresh started, or since launch before the first. */
	sinceLastMs: number;
	/** The least time between two refreshes. */
	intervalMs: number;
	/** Milliseconds until the next background transition runs a refresh. */
	dueInMs: number;
	/** Refreshes this launch. */
	runs: number;
	/** Whether one is running now. */
	running: boolean;
	/** How the platform runs refreshes while Discord is closed, or why it does not; missing on a loader from before it. */
	scheduled?: string;
};

/** The registered jobs, the last run and, on a loader that reports it, the gate. */
export type BackgroundStatus = {
	/** The registered jobs, in the order they run. */
	jobs: { name: string; owner: string }[];
	/** The last finished run this launch. */
	lastRun?: BackgroundRun;
	/** The loader's spacing, on a loader that reports it. */
	gate?: BackgroundGate;
};
