import { safeParse } from '@unbound-app/contracts/schema';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	compareRuns,
	measuredChecksSchema,
	renderChanges,
	type MeasuredCheck,
} from './compare-device-matrix';
import { evaluateJson, type Device } from './device';
import { scrollToNewest } from './device-io';
import { dropBaseline } from './device-drops';
import { catalogPlugins, renderDeviceMatrix, type CatalogPlugin } from './device-matrix';
import { settledDiscordMemory, springBoardMemory, type MemoryReport } from './device-memory';
import {
	developerModeScript,
	logLinesSchema,
	MATRIX_TOAST_MS,
	pluginLogScript,
	toastDurationScript,
} from './device-scripts';
import {
	deviceEnvironmentSchema,
	deviceEnvironmentScript,
	loaderDigest,
	readEnvironment,
	sameEnvironment,
	writeEnvironment,
} from './environment';
import { clearStagedScript, fixtureScript } from './fixture-scripts';
import { onInterrupt } from './interrupts';
import type { SelfTestResult } from './loader-self-test';
import {
	parseOffMainWarnings,
	parsePluginErrors,
	parseSkippedHooks,
	withoutSelfTest,
} from './log-parsers';
import {
	checkLeaks,
	COLLECT_GARBAGE_SCRIPT,
	cyclePlugins,
	SETTINGS_SCREEN_SUFFIX,
} from './matrix-cycles';
import { runLoaderCheck } from './matrix-loader-check';
import { applyLogPolicy, mergeChecks } from './matrix-policy';
import { scrollPhase } from './matrix-scroll';
import { afterRecovery, type FixtureChannel, type MatrixSession } from './matrix-session';
import { PLUGINS_DIR } from './paths';
import { keepGoodScreens } from './screen-diff';
import { createTimings, type PhaseTimings } from './timings';

/** What one device's run found, also written to `run.json` in its out directory as the report. */
export type DeviceRun = {
	device: { name: string };
	checks: MeasuredCheck[];
	changes: string[];
	scrollToasts?: string[];
	emptyToasts?: string[];
	scrollStuck?: boolean;
	drops?: string[];
	memory?: MemoryReport;
	selfTest?: SelfTestResult;
	timings?: PhaseTimings;
	error?: string;
};

export type DeviceRunOptions = {
	/** Where the screenshots, `results.json` and the report go. */
	out: string;
	/** The fixture channel as `<guild id>/<channel id>`. */
	channel?: string;
	/** Measures only these plugin ids, merging them into the last run's results. */
	only?: string[];
	/** The results to compare with; the out directory's `results.json` when omitted. */
	baseline?: string;
	/** Fails only on problems that are new since the last run. */
	lenient?: boolean;
	/** Cycles each plugin this many more times to measure leaks; none when 0. */
	leakCycles?: number;
	/** Measures every leak again instead of keeping unchanged plugins' results. */
	fullLeakCheck?: boolean;
	/** Removes messages earlier runs staged in the fixture channel first. */
	clearStaged?: boolean;
	/** The plugins to measure; every plugin in the repo when omitted. */
	catalog?: CatalogPlugin[];
	log?: (line: string) => void;
};

// The loader rechecks developer mode at most once a second (LoaderThreadWarnings.cpp kDeveloperModeRecheck)
// and reports nothing when it has, so each toggle waits that out for the loader to forget its old warnings.
const DEVELOPER_MODE_RECHECK_MS = 1_500;

export function parseChannel(value: string): FixtureChannel {
	const match = /^(\d+)\/(\d+)$/.exec(value.trim());

	if (!match) throw new Error('Pass --channel as <guild id>/<channel id>.');

	return { guild: match[1]!, channel: match[2]! };
}

function readBaseline(path: string, log: (line: string) => void): MeasuredCheck[] | undefined {
	if (!existsSync(path)) return undefined;

	try {
		const parsed = safeParse(measuredChecksSchema, JSON.parse(readFileSync(path, 'utf8')));

		if (parsed.success) return parsed.data;

		log(
			`the baseline ${path} does not match the results shape, so every plugin is measured again`,
		);
	} catch (error) {
		log(
			`the baseline ${path} could not be read (${String(error)}), so every plugin is measured again`,
		);
	}

	return undefined;
}

function writeReport(out: string, file: string, value: unknown) {
	writeFileSync(join(out, file), `${JSON.stringify(value, null, '\t')}\n`);
}

/**
 * @description Runs the matrix on one device: the loader self-test, each plugin's cycle, the leak check and the scroll check, then judges the logs. Writes its screenshots and report to `options.out` and puts the device back as it found it.
 * @param device The device.
 * @param options What to measure and where the report goes.
 * @returns What the run found; `error` names what stopped it early.
 */
export async function runDevice(device: Device, options: DeviceRunOptions): Promise<DeviceRun> {
	const {
		out,
		only,
		lenient = false,
		leakCycles = 0,
		log = (line) => console.error(`[${device.name}] ${line}`),
	} = options;
	const ids = only ? new Set(only) : undefined;
	const catalog = (options.catalog ?? catalogPlugins(PLUGINS_DIR)).filter(
		(plugin) => !ids || ids.has(plugin.id),
	);
	const baselinePath = options.baseline ?? join(out, 'results.json');
	const checks: MeasuredCheck[] = [];
	const changes: string[] = [];
	const timings = createTimings();
	const run: DeviceRun = { device: { name: device.name }, checks, changes };
	const fixtures = options.channel ? parseChannel(options.channel) : undefined;

	mkdirSync(out, { recursive: true });

	if (!ids) rmSync(join(out, 'crops'), { recursive: true, force: true });

	let restore: (() => Promise<void>) | undefined;
	let stopRestoringOnInterrupt = () => {};

	try {
		if (fixtures && options.clearStaged) {
			log(
				`cleared ${await device.evaluate(clearStagedScript(fixtures.channel))} staged messages`,
			);
		}

		if (fixtures) {
			await device.evaluate(fixtureScript(fixtures.guild, fixtures.channel));
			await scrollToNewest(device);
		}

		const since = new Date(Date.now() - 2_000).toISOString();
		const developerMode = (await device.evaluate(developerModeScript(false))) === 'true';
		const toastDuration: number | null = JSON.parse(
			await device.evaluate(toastDurationScript(MATRIX_TOAST_MS)),
		);
		let restored: Promise<void> | undefined;

		restore = () =>
			(restored ??= (async () => {
				if (!developerMode) await device.evaluate(developerModeScript(false));

				await device.evaluate(toastDurationScript(toastDuration));
			})());
		stopRestoringOnInterrupt = onInterrupt(restore);

		await device.sleep(DEVELOPER_MODE_RECHECK_MS);
		await device.evaluate(developerModeScript(true));
		await device.sleep(DEVELOPER_MODE_RECHECK_MS);

		const reported = await evaluateJson(
			device,
			deviceEnvironmentScript(),
			deviceEnvironmentSchema,
		);
		const environment = {
			...reported,
			loaderFile: await loaderDigest(device.target, device.run, reported.origin),
		};
		const unchanged = sameEnvironment(readEnvironment(out), environment);

		if (!unchanged) {
			changes.push(
				'the loader, client or Discord changed, so every plugin is measured again',
			);
		}

		const session: MatrixSession = {
			device,
			out,
			fixtures,
			previousRun:
				options.fullLeakCheck || !unchanged ? undefined : readBaseline(baselinePath, log),
			screenChanges: [],
			drops: [],
			dropsBefore: await dropBaseline(device.target, device.run),
			relaunched: false,
			log,
		};
		const rangeBefore = await settledDiscordMemory(device.target, device.run, device.sleep);

		run.drops = session.drops;
		timings.lap('setup');

		run.selfTest = await runLoaderCheck(session);
		log(`${run.selfTest.ok ? 'pass' : 'FAIL'} loader self-test: ${run.selfTest.detail}`);
		timings.lap('self-test');

		await cyclePlugins(session, catalog, checks);
		timings.lap('plugin cycles');

		if (leakCycles > 0) {
			await checkLeaks(session, checks, leakCycles);
			timings.lap('leak check');
		}

		const scroll = await afterRecovery(session, 'the scroll check', () =>
			scrollPhase(session, checks, since),
		);

		run.scrollToasts = scroll.toasts;
		run.emptyToasts = scroll.emptyToasts;
		run.scrollStuck = scroll.moved === false;
		timings.lap('scroll');

		await afterRecovery(session, 'the memory read', () =>
			device.evaluate(COLLECT_GARBAGE_SCRIPT),
		);

		const rangeAfter = await settledDiscordMemory(device.target, device.run, device.sleep);

		run.memory = {
			beforeMB: rangeBefore?.lowMB,
			beforeRange: rangeBefore,
			afterMB: rangeAfter?.lowMB,
			afterRange: rangeAfter,
			relaunched: session.relaunched,
			springBoard: await springBoardMemory(device.target, device.run),
		};
		log(
			`scrolled ${scroll.swipes} times${scroll.moved === false ? ' without moving the list' : ''}; ${scroll.toasts.length} toasts appeared`,
		);

		const logLines = await afterRecovery(session, 'the log read', () =>
			evaluateJson(device, pluginLogScript(), logLinesSchema),
		);
		const warnings = parseOffMainWarnings(logLines, since);
		const errors = withoutSelfTest(parsePluginErrors(logLines, since));
		const skippedHooks = parseSkippedHooks(logLines, since);

		timings.lap('logs');
		run.timings = timings.result();
		await restore();

		for (const check of checks) {
			const name = catalog.find((plugin) => plugin.id === check.id)?.name;
			const calls = name ? warnings.get(name) : undefined;
			const logged = name ? errors.get(name) : undefined;
			const skipped = name ? skippedHooks.get(name) : undefined;

			if (calls?.length) check.offMainCalls = calls;
			if (logged?.length) check.errors = logged;
			if (skipped?.length) check.skippedHooks = skipped;
		}

		const baseline = readBaseline(baselinePath, log);
		const compared = baseline?.filter((check) => !ids || ids.has(check.id));

		checks.splice(0, checks.length, ...applyLogPolicy(checks, compared, !lenient));
		writeReport(out, 'results.json', ids && baseline ? mergeChecks(baseline, checks) : checks);
		writeEnvironment(out, environment);

		if (checks.every((check) => check.behavior === 'pass' && check.lifecycle === 'pass')) {
			keepGoodScreens(out, SETTINGS_SCREEN_SUFFIX);
		}

		if (compared) {
			const compareChanges = compareRuns(compared, checks);

			writeFileSync(join(out, 'changes.md'), `${renderChanges(compareChanges)}\n`);
			changes.push(...compareChanges);
		}

		changes.push(...session.screenChanges);
		writeFileSync(
			join(out, 'matrix.md'),
			`${renderDeviceMatrix(catalog, checks, device.name)}\n`,
		);
	} catch (error) {
		run.error = `run failed: ${error instanceof Error ? error.message : String(error)}`;
		log(run.error);
		await restore?.().catch((failure) =>
			log(`Failed to restore the device: ${String(failure)}`),
		);
	} finally {
		stopRestoringOnInterrupt();
	}

	for (const change of changes) log(`changed: ${change}`);

	writeReport(out, 'run.json', run);

	return run;
}

export default { runDevice, parseChannel };
