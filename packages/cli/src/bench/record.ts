import type { LaunchKind } from '~/bench/plan';

/** Loader log milestones, in milliseconds after Discord's JavaScript runtime was created (device clock). */
export type Milestone =
	| 'pluginsRead'
	| 'bundleStart'
	| 'initStart'
	| 'pluginsStarted'
	| 'initialized'
	| 'bundleExecuted'
	| 'discordRun';

/** Discord's own `AppStartPerformance` marks, in milliseconds after the runtime was created. */
export type DiscordMark = 'indexDone' | 'firstRender' | 'fcp' | 'latestMessages' | 'uiViewed';

/** The Discord install a launch ran on. */
export type DiscordBuild = { version: string; build: string };

/** Process memory and Hermes heap counters read at one point of a launch. */
export type MemorySample = {
	/** Milliseconds after the launch request, on this machine's clock. */
	atMs: number;
	/** Every numeric field of `HermesInternal.getInstrumentedStats()`, or `null` when Hermes hides it. */
	hermes: Record<string, number> | null;
	footprintBytes: number | null;
	residentBytes: number | null;
};

/** What a launch ran: enough to tell two launches apart or prove they ran the same build. */
export type RunIdentity = {
	variant: string;
	ref: string;
	sha: string;
	bundleSha256: string;
	pluginSetHash: string;
	discord: DiscordBuild;
	loader: { sha256: string; flags: string };
	kind: LaunchKind;
	/** Position in the whole run, counting discarded launches. */
	index: number;
	discarded: boolean;
	startedAt: string;
	/** The sha256 of the bundle the loader ran, read on the device after the launch. */
	ranBundleSha256: string | null;
};

/** One launch, appended to `runs.jsonl`. */
export type RunRecord = {
	identity: RunIdentity;
	startup: Partial<Record<Milestone, number>>;
	discord: Partial<Record<DiscordMark, number>>;
	memory: { init: MemorySample | null; idle: MemorySample | null };
	work: {
		modulesInitialized: number | null;
		modulesTotal: number | null;
		pluginsStarted: number | null;
		pluginsInstalled: number;
	};
	/** Each plugin's `start()` time, or `null` when the client does not expose it. */
	pluginStartMs: Record<string, number> | null;
	/** Error lines the loader or client logged during the launch. They do not invalidate it. */
	failures: string[];
	/** Why the launch is invalid: a missing milestone, a crash, or a failed self-check. Empty when valid. */
	problems: string[];
};

/**
 * @description Whether a launch counts towards the summary.
 * @param record The launch.
 * @returns `true` for a measured launch with no problems.
 */
export function isMeasured(record: RunRecord): boolean {
	return !record.identity.discarded && record.problems.length === 0;
}

export default { isMeasured };
