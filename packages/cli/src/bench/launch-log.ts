import { parseLoaderLogLine } from '~/lib/log-lines';
import type { Milestone } from '~/bench/record';

/** The loader's own line for Discord's JavaScript runtime being created: time zero of every launch. */
export const RUNTIME_CREATED = 'RCTHost didInitializeRuntime reached.';

const PLUGINS_LOADED = /Loaded (\d+) plugins?\./;

const MARKERS: Record<Milestone, RegExp> = {
	pluginsRead: PLUGINS_LOADED,
	bundleStart: /Attempting to execute bundle\.\.\./,
	initStart: /Initializing Unbound\.\.\./,
	pluginsStarted: /(?:^|')Plugins started(?:'|$)/,
	initialized: /(?:^|')Unbound initialized(?:'|$)/,
	bundleExecuted: /Unbound's bundle was successfully executed\./,
	discordRun: /Running "Discord"/,
};

/** Milestones every launch must reach; one missing makes the launch invalid. */
export const REQUIRED_MILESTONES: Milestone[] = ['bundleExecuted', 'initialized'];

const FAILURE_LENGTH = 240;

export type LaunchLog = {
	/** When the runtime was created, in epoch milliseconds on the device clock, or `undefined` if never. */
	runtimeEpochMs: number | undefined;
	milestones: Partial<Record<Milestone, number>>;
	missing: Milestone[];
	/** Error-level lines from the launch, cut to a readable length. */
	failures: string[];
	/** The plugin count the loader read from disk (`Loaded N plugins.`), or `undefined` if it logged none. */
	pluginsLoaded: number | undefined;
};

/**
 * @description Reads one launch's milestones from the loader log written since the launch began. When the text
 * holds several launches (a crash relaunch, or a rotated log read whole), the last runtime start wins.
 * @param text The loader log lines written since the launch was requested.
 * @returns Each milestone in milliseconds after the runtime was created, what is missing, and the error lines.
 */
export function parseLaunchLog(text: string): LaunchLog {
	const entries = text.split('\n').flatMap((line) => parseLoaderLogLine(line.trimEnd()) ?? []);
	const start = entries.findLastIndex((entry) => entry.message === RUNTIME_CREATED);
	const launch = start < 0 ? [] : entries.slice(start);
	const runtimeEpochMs = launch[0]?.epochMs;
	const milestones: Partial<Record<Milestone, number>> = {};
	const failures: string[] = [];

	let pluginsLoaded: number | undefined;

	if (runtimeEpochMs === undefined) {
		return {
			runtimeEpochMs,
			milestones,
			missing: REQUIRED_MILESTONES,
			failures,
			pluginsLoaded,
		};
	}

	for (const entry of launch) {
		const loaded = PLUGINS_LOADED.exec(entry.message);

		if (pluginsLoaded === undefined && loaded) {
			pluginsLoaded = Number(loaded[1]);
		}

		if (entry.level === 'error' || entry.level === 'fatal') {
			failures.push(`[${entry.tag}] ${entry.message}`.slice(0, FAILURE_LENGTH));
		}

		for (const [milestone, marker] of Object.entries(MARKERS) as [Milestone, RegExp][]) {
			if (milestones[milestone] === undefined && marker.test(entry.message)) {
				milestones[milestone] = entry.epochMs - runtimeEpochMs;
			}
		}
	}

	const missing = REQUIRED_MILESTONES.filter((milestone) => milestones[milestone] === undefined);

	return { runtimeEpochMs, milestones, missing, failures, pluginsLoaded };
}

export default { RUNTIME_CREATED, REQUIRED_MILESTONES, parseLaunchLog };
