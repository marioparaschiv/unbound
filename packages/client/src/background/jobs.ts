import type {
	BackgroundJob,
	BackgroundJobResult,
	BackgroundRun,
} from '@unbound-app/types/background';

/** A registered job. Phases run in order; the jobs of one phase run together. */
export type BackgroundEntry = {
	name: string;
	owner: string;
	run: BackgroundJob;
	phase: number;
};

/** The phase plugin jobs and most built-ins run in, after settings are saved and before upkeep that reads their results. */
export const DEFAULT_PHASE = 1;

/** How long one job may take before the run records it as timed out and moves on. */
export const JOB_TIMEOUT_MS = 20_000;

const entries = new Set<BackgroundEntry>();
let lastRun: BackgroundRun | undefined;
let running: Promise<BackgroundRun> | undefined;

function describe(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

function withTimeout(job: BackgroundJob, limitMs: number): Promise<void> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => reject(new Error(`timed out after ${limitMs / 1000} s`)), limitMs);
	});

	return Promise.race([Promise.resolve().then(job), timeout]).finally(() => clearTimeout(timer));
}

async function runEntry(entry: BackgroundEntry, limitMs: number): Promise<BackgroundJobResult> {
	const started = Date.now();
	const result = { name: entry.name, owner: entry.owner };

	try {
		await withTimeout(entry.run, limitMs);

		return { ...result, ok: true, durationMs: Date.now() - started };
	} catch (error) {
		return { ...result, ok: false, durationMs: Date.now() - started, error: describe(error) };
	}
}

function phases(): BackgroundEntry[][] {
	const byPhase = new Map<number, BackgroundEntry[]>();

	for (const entry of entries) {
		byPhase.set(entry.phase, [...(byPhase.get(entry.phase) ?? []), entry]);
	}

	return [...byPhase.keys()].sort((a, b) => a - b).map((phase) => byPhase.get(phase) ?? []);
}

/**
 * @description Registers a job for every later background refresh.
 * @param entry The job, its owner and phase.
 * @returns A function that removes it; calling it twice is safe.
 */
export function addBackgroundJob(entry: BackgroundEntry): () => void {
	entries.add(entry);

	return () => void entries.delete(entry);
}

/**
 * @description Runs every registered job, phase by phase, isolating failures and timeouts so one job never stops the rest.
 * A call while a run is in flight returns that run.
 * @param trigger What started the run.
 * @param limitMs How long each job may take.
 * @returns The run.
 */
export function runBackgroundJobs(
	trigger: BackgroundRun['trigger'],
	limitMs = JOB_TIMEOUT_MS,
): Promise<BackgroundRun> {
	running ??= (async () => {
		const startedAt = Date.now();
		const jobs: BackgroundJobResult[] = [];

		for (const phase of phases()) {
			jobs.push(...(await Promise.all(phase.map((entry) => runEntry(entry, limitMs)))));
		}

		lastRun = { trigger, startedAt, durationMs: Date.now() - startedAt, jobs };

		return lastRun;
	})().finally(() => {
		running = undefined;
	});

	return running;
}

/**
 * @description Lists the registered jobs in the order they run.
 * @returns Each job's name and owner.
 */
export function backgroundJobs(): { name: string; owner: string }[] {
	return phases()
		.flat()
		.map(({ name, owner }) => ({ name, owner }));
}

/**
 * @description Reads the last finished run.
 * @returns The run, or `undefined` before the first.
 */
export function lastBackgroundRun(): BackgroundRun | undefined {
	return lastRun;
}
