/** Work the background refresh runs while Discord is in the background. */
export type BackgroundJob = () => Promise<void> | void;

/** How one job went in a run. */
export type BackgroundJobResult = {
	/** The job's name. */
	name: string;
	/** The plugin id that added it, or `unbound` for a built-in. */
	owner: string;
	/** Whether it finished without throwing or timing out. */
	ok: boolean;
	/** How long it ran. */
	durationMs: number;
	/** What failed, when it did. */
	error?: string;
};

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
