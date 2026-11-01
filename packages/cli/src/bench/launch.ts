import { setTimeout as sleep } from 'node:timers/promises';
import type { z } from 'zod';

import {
	currentBundleSha,
	logSize,
	readLaunchLog,
	readSettings,
	withoutModuleCache,
	writeSettings,
	type DevicePaths,
} from '~/bench/device';
import {
	gcProbe,
	hermesSampleSchema,
	idleProbe,
	idleSampleSchema,
	initProbe,
	relativeMarks,
	type IdleSample,
} from '~/bench/probe';
import type { DiscordBuild, MemorySample, RunRecord } from '~/bench/record';
import { parseLaunchLog, type LaunchLog } from '~/bench/launch-log';
import { evaluateOnDevice, type DeviceClient } from '~/lib/device';
import type { AddonMode, LaunchKind } from '~/bench/plan';
import type { VariantBuild } from '~/bench/build';
import type { BenchServer } from '~/bench/server';
import type { Vphone } from '~/bench/vphone';

const MILESTONE_TIMEOUT_MS = 30_000;
const LOG_POLL_MS = 500;
const INIT_SAMPLE_TIMEOUT_MS = 20_000;
const EVAL_TIMEOUT_MS = 15_000;
const EVAL_RETRY_MS = 1_000;

export type LaunchContext = {
	vphone: Vphone;
	server: BenchServer;
	paths: DevicePaths;
	client: DeviceClient;
	discord: DiscordBuild;
	idleMs: number;
	addons: AddonMode;
	signal: AbortSignal;
};

export type LaunchSpec = {
	build: VariantBuild;
	kind: LaunchKind;
	index: number;
	discarded: boolean;
};

type MilestoneWait = { log: LaunchLog; problem?: string };

// UNKNOWN: the probe's answer, which the caller's schema parses.
function json(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

/**
 * @description Evaluates a probe until it answers from this launch's runtime, or the deadline passes. Right after a
 * launch the bridge may still hold the previous process, or no device at all.
 */
async function sample<T extends { launch: string | null }>(
	context: LaunchContext,
	code: string,
	schema: z.ZodType<T>,
	accept: (value: T) => boolean,
	deadline: number,
): Promise<T | string> {
	let last = 'the device never connected to the debugger bridge';

	while (Date.now() < deadline) {
		const result = await evaluateOnDevice(context.client, code, EVAL_TIMEOUT_MS);

		if (result?.ok) {
			const parsed = schema.safeParse(json(result.value));

			if (parsed.success && accept(parsed.data)) {
				return parsed.data;
			}

			last = parsed.success
				? `the bridge answered from another launch (${parsed.data.launch})`
				: `unexpected probe answer: ${result.value.slice(0, 200)}`;
		} else if (result) {
			last = `the probe threw: ${result.error.slice(0, 200)}`;
		}

		await sleep(EVAL_RETRY_MS, undefined, { signal: context.signal });
	}

	return last;
}

async function waitForMilestones(
	context: LaunchContext,
	offset: number,
	deadline: number,
): Promise<MilestoneWait> {
	for (;;) {
		await sleep(LOG_POLL_MS, undefined, { signal: context.signal });
		const log = parseLaunchLog(await readLaunchLog(context.vphone, context.paths, offset));

		if (log.missing.length === 0) {
			return { log };
		}

		if (!(await context.vphone.discord())) {
			return {
				log,
				problem: `Discord exited before reaching ${log.missing.join(' and ')} (crash)`,
			};
		}

		if (Date.now() > deadline) {
			return {
				log,
				problem: `never reached ${log.missing.join(' and ')} within ${MILESTONE_TIMEOUT_MS / 1000} s`,
			};
		}
	}
}

async function memory(
	context: LaunchContext,
	hermes: Record<string, number> | null,
	launchedAt: number,
): Promise<MemorySample> {
	const process = await context.vphone.discord();

	return {
		atMs: Date.now() - launchedAt,
		hermes,
		footprintBytes: process?.footprintBytes ?? null,
		residentBytes: process?.residentBytes ?? null,
	};
}

/**
 * @description Checks a launch against its addon mode: with `none` the loader must log `Loaded 0 plugins.` and no
 * plugin may start; with `all` at least one installed plugin must start.
 * @param addons The run's addon mode.
 * @param spec The launch.
 * @param idle The idle sample, if one was read.
 * @param pluginsLoaded The plugin count the loader logged.
 * @returns Why the launch is invalid; empty when it passes.
 */
export function addonCheck(
	addons: AddonMode,
	spec: LaunchSpec,
	idle: IdleSample | undefined,
	pluginsLoaded: number | undefined,
): string[] {
	if (addons === 'all') {
		return idle && idle.pluginsStarted === 0 && spec.build.pluginCount > 0
			? [`no plugin started out of ${spec.build.pluginCount}`]
			: [];
	}

	if (pluginsLoaded !== 0) {
		return [
			`addons are off, but the loader logged ${pluginsLoaded === undefined ? 'no plugin count' : `Loaded ${pluginsLoaded} plugins`}`,
		];
	}

	return idle && idle.pluginsStarted > 0
		? [`addons are off, but ${idle.pluginsStarted} plugins started`]
		: [];
}

function selfCheck(
	spec: LaunchSpec,
	idle: IdleSample | undefined,
	ranBundleSha256: string | null,
): string[] {
	const problems: string[] = [];

	if (!spec.discarded && ranBundleSha256 !== spec.build.bundleSha256) {
		problems.push(
			`ran bundle ${ranBundleSha256?.slice(0, 12) ?? 'none'}, not ${spec.build.variant}'s ${spec.build.bundleSha256.slice(0, 12)}`,
		);
	}

	if (idle && !idle.modulesInitialized) {
		problems.push(
			'no Metro module was counted as initialized: the runtime has no global `modules` map',
		);
	}

	return problems;
}

/**
 * @description Runs one launch: stops Discord, empties the module cache for a cold launch, launches, waits for
 * Unbound's milestones, samples memory after init and at idle, then proves which bundle ran.
 * @param context The device, bridge and protocol.
 * @param spec The variant, kind and position of this launch.
 * @returns The launch's record; `problems` names why it is invalid, if it is.
 */
export async function runLaunch(context: LaunchContext, spec: LaunchSpec): Promise<RunRecord> {
	const { vphone, paths } = context;
	const { build } = spec;

	await vphone.stopDiscord();

	if (spec.kind === 'cold') {
		await writeSettings(
			vphone,
			context.server,
			paths,
			withoutModuleCache(await readSettings(vphone, paths)),
		);
	}

	const offset = await logSize(vphone, paths);
	const launchId = `${Date.now()}-${spec.index}`;
	const startedAt = new Date().toISOString();
	const launchedAt = Date.now();

	await vphone.launchDiscord();
	const { log, problem } = await waitForMilestones(
		context,
		offset,
		launchedAt + MILESTONE_TIMEOUT_MS,
	);
	const problems = problem ? [problem] : [];
	let init: MemorySample | null = null;
	let idle: IdleSample | undefined;
	let idleMemory: MemorySample | null = null;
	let gcMemory: MemorySample | null = null;

	if (!problem) {
		const pid = (await vphone.discord())?.pid;
		const initAnswer = await sample(
			context,
			initProbe(launchId),
			hermesSampleSchema,
			(v) => v.launch === null || v.launch === launchId,
			Date.now() + INIT_SAMPLE_TIMEOUT_MS,
		);

		if (typeof initAnswer === 'string') {
			problems.push(`no sample after init: ${initAnswer}`);
		} else {
			init = await memory(context, initAnswer.hermes, launchedAt);
		}

		await sleep(Math.max(0, launchedAt + context.idleMs - Date.now()), undefined, {
			signal: context.signal,
		});
		const idleAnswer = await sample(
			context,
			idleProbe(),
			idleSampleSchema,
			(v) => v.launch === launchId,
			Date.now() + EVAL_TIMEOUT_MS,
		);

		if (typeof idleAnswer === 'string') {
			problems.push(`no idle sample: ${idleAnswer}`);
		} else {
			idle = idleAnswer;
		}

		idleMemory = idle ? await memory(context, idle.hermes, launchedAt) : null;

		// After every other sample, because the forced GC shrinks the heap and footprint they read.
		const gcAnswer = await sample(
			context,
			gcProbe(),
			hermesSampleSchema,
			(v) => v.launch === launchId,
			Date.now() + EVAL_TIMEOUT_MS,
		);

		if (typeof gcAnswer === 'string') {
			problems.push(`no sample after a forced GC: ${gcAnswer}`);
		} else {
			gcMemory = await memory(context, gcAnswer.hermes, launchedAt);
		}

		if ((await vphone.discord())?.pid !== pid) {
			problems.push('Discord restarted between the samples (crash)');
		}

		await vphone.dismissAlert();
	}

	const ranBundleSha256 = await currentBundleSha(vphone, paths);

	return {
		identity: {
			variant: build.variant,
			ref: build.ref,
			sha: build.sha,
			bundleSha256: build.bundleSha256,
			pluginSetHash: build.pluginSetHash,
			discord: context.discord,
			loader: { sha256: build.loaderSha256, flags: build.loaderFlags },
			kind: spec.kind,
			addons: context.addons,
			index: spec.index,
			discarded: spec.discarded,
			startedAt,
			ranBundleSha256,
		},
		startup: log.milestones,
		discord: relativeMarks(idle?.discord, log.runtimeEpochMs),
		memory: { init, idle: idleMemory, idleAfterGc: gcMemory },
		work: {
			modulesInitialized: idle?.modulesInitialized ?? null,
			modulesTotal: idle?.modulesTotal ?? null,
			pluginsLoaded: log.pluginsLoaded ?? null,
			pluginsStarted: idle?.pluginsStarted ?? null,
			pluginsInstalled: build.pluginCount,
		},
		pluginStartMs: idle?.pluginStartMs ?? null,
		failures: [
			...log.failures,
			...(idle?.pluginErrors.map((e) => `plugin failed: ${e}`) ?? []),
		],
		problems: [
			...problems,
			...selfCheck(spec, idle, ranBundleSha256),
			...addonCheck(context.addons, spec, idle, log.pluginsLoaded),
		],
	};
}

export default { addonCheck, runLaunch };
