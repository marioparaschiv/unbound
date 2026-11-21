/** Work the background refresh runs while Discord is in the background. */
export type BackgroundJob = () => Promise<void> | void;

/** How one job went in a run. */
export type BackgroundJobResult = {
	name: string;
	/** The plugin id that added it, or `unbound` for a built-in. */
	owner: string;
	ok: boolean;
	durationMs: number;
	/** What failed, when it did. */
	error?: string;
};

/** One background refresh: what started it, when, and how each job went. */
export type BackgroundRun = {
	/** `loader` when Discord went to the background or the scheduled refresh fired; `manual` from `background.run()`. */
	trigger: 'loader' | 'manual';
	startedAt: number;
	durationMs: number;
	jobs: BackgroundJobResult[];
};

/** The loader's spacing of background refreshes. */
export type BackgroundGate = {
	/** Milliseconds since the last refresh started, or since launch before the first. */
	sinceLastMs: number;
	intervalMs: number;
	/** Milliseconds until the next background transition runs a refresh. */
	dueInMs: number;
	runs: number;
	running: boolean;
};

/** The registered jobs, the last run and, on a loader that reports it, the gate. */
export type BackgroundStatus = {
	jobs: { name: string; owner: string }[];
	lastRun?: BackgroundRun;
	gate?: BackgroundGate;
};
