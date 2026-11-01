import { z } from 'zod';

import type { DiscordMark } from '~/bench/record';

/** Discord's `AppStartPerformance` log names for the marks the report reads. */
export const DISCORD_MARKS: Record<DiscordMark, string> = {
	indexDone: 'Finish Load index.tsx',
	firstRender: 'First React Render',
	fcp: 'First Contentful Paint',
	latestMessages: 'Display Latest Messages',
	uiViewed: 'app_ui_viewed logged',
};

// Keeps only the numeric counters; Hermes mixes experiment flags and strings into the same object.
const HERMES_STATS = `(function () {
		if (typeof HermesInternal === 'undefined' || !HermesInternal.getInstrumentedStats) return null;
		var stats = HermesInternal.getInstrumentedStats();
		var numbers = {};
		Object.keys(stats).forEach(function (key) { if (typeof stats[key] === 'number') numbers[key] = stats[key]; });
		return numbers;
	})()`;

/**
 * @description Device code for the sample after init: tags the runtime with the launch id, so a later sample can
 * prove it reads the same process, and reads the Hermes heap counters.
 * @param launchId A value unique to this launch.
 * @returns The JavaScript, which returns JSON.
 */
export function initProbe(launchId: string): string {
	return `(function () {
	var previous = globalThis.__unboundBenchLaunch;
	globalThis.__unboundBenchLaunch = ${JSON.stringify(launchId)};
	return JSON.stringify({ launch: previous === undefined ? null : previous, hermes: ${HERMES_STATS} });
})()`;
}

/**
 * @description Device code for the idle sample. Counts initialized Metro modules before anything else, because the
 * Discord-mark lookup below can itself initialize modules.
 * @returns The JavaScript, which returns JSON.
 */
export function idleProbe(): string {
	return `(function () {
	var out = { launch: globalThis.__unboundBenchLaunch === undefined ? null : globalThis.__unboundBenchLaunch };
	var modules = globalThis.modules;
	if (modules) {
		var list = typeof modules.values === 'function' ? Array.from(modules.values()) : Object.values(modules);
		out.modulesTotal = list.length;
		out.modulesInitialized = list.filter(function (m) { return m && m.isInitialized; }).length;
	}
	out.hermes = ${HERMES_STATS};
	var plugins = unbound.plugins;
	out.pluginsStarted = Array.from(plugins.entities.values()).filter(function (e) { return e.started; }).length;
	out.pluginErrors = Array.from(plugins.errors.entries()).map(function (entry) { return entry[0] + ': ' + String(entry[1] && entry[1].message || entry[1]); });
	var durations = plugins.startDurations;
	out.pluginStartMs = durations && typeof durations.forEach === 'function' ? Object.fromEntries(durations) : null;
	try {
		var perf = unbound.metro.findByProps('markAndLog', 'markWithDelta');
		var group = perf && perf.logGroups && perf.logGroups[0];
		var names = ${JSON.stringify(DISCORD_MARKS)};
		out.discord = {};
		Object.keys(names).forEach(function (key) {
			var hit = group && group.logs.find(function (l) { return l.log === names[key] && l.timestamp; });
			if (hit) out.discord[key] = hit.timestamp;
		});
	} catch (error) {
		out.discordError = String(error);
	}
	return JSON.stringify(out);
})()`;
}

/**
 * @description Device code for the last sample: forces a full GC, then reads the Hermes heap counters, so
 * `js_allocatedBytes` counts only live objects. Without a global `gc` it returns `null` counters.
 * @returns The JavaScript, which returns JSON.
 */
export function gcProbe(): string {
	return `(function () {
	var launch = globalThis.__unboundBenchLaunch === undefined ? null : globalThis.__unboundBenchLaunch;
	if (typeof gc !== 'function') return JSON.stringify({ launch: launch, hermes: null });
	gc();
	return JSON.stringify({ launch: launch, hermes: ${HERMES_STATS} });
})()`;
}

const hermesSchema = z.record(z.string(), z.number()).nullable();

export const hermesSampleSchema = z.object({ launch: z.string().nullable(), hermes: hermesSchema });

export const idleSampleSchema = z.object({
	launch: z.string().nullable(),
	modulesTotal: z.number().optional(),
	modulesInitialized: z.number().optional(),
	hermes: hermesSchema,
	pluginsStarted: z.number(),
	pluginErrors: z.array(z.string()),
	pluginStartMs: z.record(z.string(), z.number()).nullable(),
	discord: z.record(z.string(), z.number()).optional(),
	discordError: z.string().optional(),
});

export type IdleSample = z.infer<typeof idleSampleSchema>;

/**
 * @description Turns Discord's epoch-millisecond marks into milliseconds after the runtime was created.
 * @param marks The marks the idle probe read, keyed like {@link DISCORD_MARKS}.
 * @param runtimeEpochMs When the runtime was created, from the loader log on the same device clock.
 * @returns The marks Discord logged, relative to the runtime.
 */
export function relativeMarks(
	marks: Record<string, number> | undefined,
	runtimeEpochMs: number | undefined,
): Partial<Record<DiscordMark, number>> {
	if (!marks || runtimeEpochMs === undefined) {
		return {};
	}

	const keys = Object.keys(DISCORD_MARKS) as DiscordMark[];

	return Object.fromEntries(
		keys.flatMap((key) =>
			marks[key] === undefined ? [] : [[key, marks[key] - runtimeEpochMs]],
		),
	);
}

export default {
	DISCORD_MARKS,
	initProbe,
	idleProbe,
	gcProbe,
	hermesSampleSchema,
	idleSampleSchema,
	relativeMarks,
};
