import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
	evaluate,
	evaluateJson,
	isDisconnect,
	run,
	screenSize,
	screenshot,
	screenshotTarget,
	scrollStress,
	scrollToNewest,
	swipeAll,
	swipeCommands,
	waitForBridge,
	type ScrollOutcome,
} from './device-io';
import {
	cycleResultSchema,
	cycleScript,
	developerModeScript,
	clearStagedScript,
	redrawTimesScript,
	redrawTimesSchema,
	fixtureScript,
	fixturesPresentScript,
	logLinesSchema,
	pluginLogScript,
	restoreScript,
	scrollFillerScript,
	toastDurationScript,
	toastLogScript,
	MATRIX_TOAST_MS,
	settingsScreenScript,
	selfTestsScript,
	selfTestReportsSchema,
	settingsProbeScript,
	settingsProbeSchema,
	type SettingsProbe,
	closeScreenScript,
} from './device-scripts';
import { withSettings } from './settings-check';
import { reusableLeak, reusableSettings } from './run-reuse';
import {
	deviceEnvironmentSchema,
	deviceEnvironmentScript,
	loaderDigest,
	readEnvironment,
	sameEnvironment,
	writeEnvironment,
} from './environment';
import {
	describeScreenChange,
	keepGoodScreens,
	referenceFor,
	saveFullResolutionBands,
	screenDifference,
} from './screen-diff';
import {
	isEmptyToast,
	parseOffMainWarnings,
	parsePluginErrors,
	parseSkippedHooks,
	parseToastLines,
	withoutSelfTest,
} from './log-parsers';
import {
	judgeSelfTest,
	selfTestCancellationScript,
	selfTestCountsSchema,
	selfTestFinishScript,
	selfTestStartScript,
	type SelfTestResult,
} from './loader-self-test';
import {
	compareRuns,
	measuredChecksSchema,
	renderChanges,
	type MeasuredCheck,
} from './compare-device-matrix';
import { catalogPlugins, renderDeviceMatrix, type CatalogPlugin } from './device-matrix';
import { applyLogPolicy, checkFromCycle, mergeChecks } from './matrix-policy';
import { dropBaseline, dropReason, relaunchCommands } from './device-drops';
import { growthPerCycle, leakNote, liveHeapScript } from './leak-check';
import { discordMemory, settledDiscordMemory, springBoardMemory } from './device-memory';
import { readMatrixConfig } from './matrix-config';
import { PLUGINS_DIR } from './paths';
import { createTimings } from './timings';

type FixtureChannel = { guild: string; channel: string };

type ScrollReport = ScrollOutcome & { toasts: string[]; emptyToasts: string[] };

const SELF_TEST_SWIPES = 4;
const TOAST_SETTLE_MS = 5_500;
const SCROLL_REDRAW_LIMIT_MS = 2_000;
const SCROLL_SETTLE_MS = 300;
const SETTINGS_SETTLE_MS = 1_200;
const SETTINGS_SCREEN_SUFFIX = '.settings.png';
const COLLECT_GARBAGE_SCRIPT = "typeof gc === 'function' ? (gc(), 'collected') : 'unavailable'";

export function parseChannel(value: string): FixtureChannel {
	const match = /^(\d+)\/(\d+)$/.exec(value.trim());

	if (!match) throw new Error('Pass --channel as <guild id>/<channel id>.');

	return { guild: match[1]!, channel: match[2]! };
}

function readBaseline(path: string): MeasuredCheck[] | undefined {
	if (!existsSync(path)) return undefined;

	try {
		const parsed = measuredChecksSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));

		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		options: {
			port: { type: 'string', default: '9090' },
			out: { type: 'string' },
			serial: { type: 'string' },
			ios: { type: 'boolean' },
			udid: { type: 'string' },
			only: { type: 'string' },
			channel: { type: 'string' },
			device: { type: 'string' },
			baseline: { type: 'string' },
			lenient: { type: 'boolean' },
			'leak-cycles': { type: 'string' },
			'full-leak-check': { type: 'boolean' },
			'clear-staged': { type: 'boolean' },
		},
	});

	if (!values.out) {
		throw new Error(
			'Usage: bun packages/plugin-scripts/src/collect-device-matrix.ts --out <dir> [--port 9090] [--serial <adb serial> | --udid <iPhone UDID>] [--only <id,id>] [--device <name>] [--baseline <results.json>] [--channel <guild id>/<channel id>] [--lenient] [--leak-cycles <n>] [--full-leak-check] [--clear-staged]',
		);
	}

	const port = Number(values.port);
	const out = resolve(values.out);
	const target = screenshotTarget(values);
	const only = values.only ? new Set(values.only.split(',')) : undefined;
	const catalog = catalogPlugins(PLUGINS_DIR).filter((plugin) => !only || only.has(plugin.id));
	const checks: MeasuredCheck[] = [];

	mkdirSync(out, { recursive: true });

	const crops = join(out, 'crops');

	if (!only) rmSync(crops, { recursive: true, force: true });

	const timings = createTimings();
	const screenChanges: string[] = [];
	const fixtureChannel = values.channel ?? readMatrixConfig()?.channel;
	const fixtures = fixtureChannel ? parseChannel(fixtureChannel) : undefined;

	if (fixtures && values['clear-staged']) {
		console.error(
			`cleared ${await evaluate(port, clearStagedScript(fixtures.channel))} staged messages`,
		);
	}

	if (fixtures) {
		await evaluate(port, fixtureScript(fixtures.guild, fixtures.channel));
		await scrollToNewest(target);
	}

	const since = new Date(Date.now() - 2_000).toISOString();
	const developerMode = (await evaluate(port, developerModeScript(false))) === 'true';
	const toastDuration = JSON.parse(await evaluate(port, toastDurationScript(MATRIX_TOAST_MS))) as
		| number
		| null;
	let restored: Promise<void> | undefined;
	const restoreDevice = () =>
		(restored ??= (async () => {
			if (!developerMode) await evaluate(port, developerModeScript(false));

			await evaluate(port, toastDurationScript(toastDuration));
		})());
	const stopOnSignal = (signal: NodeJS.Signals, code: number) =>
		process.once(signal, () => {
			console.error(`${signal}: restoring the device before exiting`);
			void restoreDevice()
				.catch((error) => console.error('Failed to restore the device:', error))
				.finally(() => process.exit(code));
		});

	stopOnSignal('SIGINT', 130);
	stopOnSignal('SIGTERM', 143);

	await new Promise((done) => setTimeout(done, 1_500));
	await evaluate(port, developerModeScript(true));
	await new Promise((done) => setTimeout(done, 1_500));

	const deviceEnvironment = await evaluateJson(
		port,
		deviceEnvironmentScript(),
		deviceEnvironmentSchema,
	);
	const environment = {
		...deviceEnvironment,
		loaderFile: await loaderDigest(target, run, deviceEnvironment.origin),
	};
	const unchanged = sameEnvironment(readEnvironment(out), environment);
	const previousRun =
		values['full-leak-check'] || !unchanged
			? undefined
			: readBaseline(values.baseline ? resolve(values.baseline) : join(out, 'results.json'));

	if (!unchanged)
		console.error(
			'changed: the loader, client or Discord changed, so every plugin is measured again',
		);

	const dropsBefore = await dropBaseline(target, run);
	const memoryBefore = await settledDiscordMemory(target, run);
	let relaunched = false;

	async function measure(plugin: CatalogPlugin): Promise<MeasuredCheck> {
		if (
			fixtures &&
			(await evaluate(port, fixturesPresentScript(fixtures.channel))) !== 'present'
		) {
			console.error(`fixtures were gone before ${plugin.id}; staging them again`);
			await evaluate(port, fixtureScript(fixtures.guild, fixtures.channel));
		}

		const result = await evaluateJson(port, cycleScript(plugin.id), cycleResultSchema);
		const file = join(out, `${plugin.id}.png`);
		const captured = result.installed && (await screenshot(target, file));

		if (captured) await saveFullResolutionBands(file, crops, plugin.id);
		const keptSettings = reusableSettings(plugin.id, result.bundleHash, previousRun);
		const settings =
			result.installed && !keptSettings ? await captureSettings(plugin.id) : undefined;

		if (result.installed && !result.wasStarted) await evaluate(port, restoreScript(plugin.id));

		const check = checkFromCycle(result, captured ? `${plugin.id}.png` : undefined);

		if (keptSettings) {
			check.evidence.push(
				`${keptSettings} (kept from the last run, the plugin is unchanged)`,
			);
		}

		return settings ? withSettings(check, settings.file, settings.probe) : check;
	}

	async function captureSettings(
		id: string,
	): Promise<{ file: string | undefined; probe: SettingsProbe } | undefined> {
		if ((await evaluate(port, settingsScreenScript(id))) !== 'opened') return;

		await new Promise((done) => setTimeout(done, SETTINGS_SETTLE_MS));

		const file = `${id}${SETTINGS_SCREEN_SUFFIX}`;
		const previous = referenceFor(join(out, file));
		const captured = await screenshot(target, join(out, file));

		if (captured && previous) {
			const change = describeScreenChange(
				`${id} settings`,
				await screenDifference(previous, join(out, file)),
			);

			if (change) screenChanges.push(change);
		}
		const probe = await evaluateJson(port, settingsProbeScript(), settingsProbeSchema);

		await evaluate(port, closeScreenScript());
		await new Promise((done) => setTimeout(done, SETTINGS_SETTLE_MS));

		return { file: captured ? file : undefined, probe };
	}

	async function recover(id: string): Promise<string> {
		const reason =
			(await dropReason(target, dropsBefore, run)) ??
			'Discord stopped answering, and no crash or memory report explains it';

		console.error(`dropped: ${id}: ${reason}`);
		relaunched = true;

		for (const command of relaunchCommands(target)) await run(command);

		await waitForBridge(port);

		if (fixtures) await evaluate(port, fixtureScript(fixtures.guild, fixtures.channel));

		await evaluate(port, developerModeScript(true));
		Object.assign(dropsBefore, await dropBaseline(target, run));

		return reason;
	}

	async function selfTest(): Promise<SelfTestResult> {
		const started = new Date(Date.now() - 1_000).toISOString();
		const host = await evaluate(port, selfTestStartScript());

		if (host.startsWith('error: ')) return { ok: false, detail: host.slice('error: '.length) };

		await swipeAll(swipeCommands(target, await screenSize(target), SELF_TEST_SWIPES));
		await Bun.sleep(1_500);

		const counts = await evaluateJson(port, selfTestFinishScript(), selfTestCountsSchema);
		const ended = await evaluateJson(port, selfTestCancellationScript(), selfTestCountsSchema);

		if (ended.error) return { ok: false, detail: ended.error };

		if (ended.host === counts.host) counts.cancellations = ended.cancellations;

		await Bun.sleep(1_000);

		const lines = await evaluateJson(port, pluginLogScript(), logLinesSchema);

		return judgeSelfTest(counts, parsePluginErrors(lines, started));
	}

	timings.lap('setup');

	let loaderCheck: SelfTestResult;

	try {
		loaderCheck = await selfTest();
	} catch (error) {
		if (!isDisconnect(error)) throw error;

		loaderCheck = {
			ok: false,
			detail: `Discord stopped answering during the self-test: ${await recover('the loader self-test')}`,
		};
	}

	writeFileSync(join(out, 'selftest.json'), `${JSON.stringify(loaderCheck, null, '\t')}\n`);
	console.error(`${loaderCheck.ok ? 'pass' : 'FAIL'} loader self-test: ${loaderCheck.detail}`);
	timings.lap('self-test');

	for (const plugin of catalog) {
		let check: MeasuredCheck | undefined;

		for (let attempt = 0; !check; attempt++) {
			try {
				const before = await discordMemory(target, run);

				check = await measure(plugin);

				await evaluate(port, COLLECT_GARBAGE_SCRIPT);

				const after = await discordMemory(target, run);

				if (before !== undefined && after !== undefined) {
					check.memoryDeltaMB = Math.round(after - before);
				}
			} catch (error) {
				if (!isDisconnect(error)) throw error;

				const reason = await recover(plugin.id);

				if (attempt >= 1) {
					check = {
						id: plugin.id,
						behavior: 'fail',
						lifecycle: 'fail',
						evidence: [],
						note: `the device dropped twice: ${reason}`,
					};
				}
			}
		}

		checks.push(check);
		console.error(
			`${check.lifecycle === 'pass' && check.behavior === 'pass' ? 'pass' : 'FAIL'} ${plugin.id}`,
		);
	}

	const leakCycles = Number(values['leak-cycles'] ?? 0);

	async function cycleQuietly(id: string): Promise<void> {
		const result = await evaluateJson(port, cycleScript(id), cycleResultSchema);

		if (result.installed && !result.wasStarted) await evaluate(port, restoreScript(id));
	}

	function recordLeak(check: MeasuredCheck, perCycle: number) {
		check.leakPerCycleMB = perCycle;

		const note = leakNote(perCycle, leakCycles);

		if (note) {
			check.behavior = 'fail';
			check.note = [check.note, note].filter(Boolean).join('; ');
		}
	}

	async function leakCheck(check: MeasuredCheck): Promise<void> {
		const reused = reusableLeak(check, previousRun);

		if (reused !== undefined) {
			recordLeak(check, reused);
			check.evidence.push('leak check: kept from the last run, the bundle is unchanged');
			console.error(`leak check ${check.id}: ${reused} MB per cycle, kept from the last run`);

			return;
		}

		await cycleQuietly(check.id);

		const before = Number(await evaluate(port, liveHeapScript()));

		for (let cycle = 0; cycle < leakCycles; cycle++) await cycleQuietly(check.id);

		const perCycle = growthPerCycle(
			before,
			Number(await evaluate(port, liveHeapScript())),
			leakCycles,
		);

		if (perCycle === undefined) return;

		recordLeak(check, perCycle);
		console.error(`leak check ${check.id}: ${perCycle} MB per cycle`);
	}

	timings.lap('plugin cycles');

	if (leakCycles > 0) {
		for (const check of checks) {
			try {
				await leakCheck(check);
			} catch (error) {
				if (!isDisconnect(error)) throw error;

				await recover(`the leak check of ${check.id}`);
			}
		}
	}

	if (leakCycles > 0) timings.lap('leak check');

	async function afterRecovery<T>(label: string, step: () => Promise<T>): Promise<T> {
		try {
			return await step();
		} catch (error) {
			if (!isDisconnect(error)) throw error;

			await recover(label);

			return step();
		}
	}

	function recordScrollProblem(check: MeasuredCheck, detail: string) {
		const problem = `after scrolling: ${detail}`;

		check.behavior = 'fail';
		check.note = [check.note, problem].filter(Boolean).join('; ');
		check.visualProblems = [...(check.visualProblems ?? []), problem];
	}

	async function scrollPhase(): Promise<ScrollReport> {
		if (fixtures) await evaluate(port, scrollFillerScript(fixtures.channel));

		await Bun.sleep(TOAST_SETTLE_MS);

		const scrollSince = new Date().toISOString();
		const { swipes, moved } = await scrollStress(target, out);
		const redraws = await evaluateJson(
			port,
			redrawTimesScript(SCROLL_REDRAW_LIMIT_MS),
			redrawTimesSchema,
		);

		for (const check of checks) {
			if (redraws[check.id] !== undefined) check.redrawMs = redraws[check.id];
		}

		await Bun.sleep(SCROLL_SETTLE_MS);

		const afterScroll = await evaluateJson(port, selfTestsScript(), selfTestReportsSchema);

		for (const check of checks) {
			const report = afterScroll[check.id];

			if (report && !report.ok && !report.nothingDrawn)
				recordScrollProblem(check, report.detail);
		}

		const toastLines = await evaluateJson(port, toastLogScript(), logLinesSchema);

		return {
			swipes,
			moved,
			toasts: parseToastLines(toastLines, scrollSince),
			emptyToasts: parseToastLines(toastLines, since).filter(isEmptyToast),
		};
	}

	const scroll = await afterRecovery('the scroll check', scrollPhase);

	timings.lap('scroll');

	writeFileSync(join(out, 'scroll.json'), `${JSON.stringify(scroll, null, '\t')}\n`);

	await afterRecovery('the memory read', () => evaluate(port, COLLECT_GARBAGE_SCRIPT));

	const memory = {
		beforeMB: memoryBefore,
		afterMB: await settledDiscordMemory(target, run),
		relaunched,
		springBoard: await springBoardMemory(target, run),
	};

	writeFileSync(join(out, 'memory.json'), `${JSON.stringify(memory, null, '\t')}\n`);
	console.error(
		`scrolled ${scroll.swipes} times${scroll.moved === false ? ' without moving the list' : ''}; ${scroll.toasts.length} toasts appeared`,
	);

	const logLines = await afterRecovery('the log read', () =>
		evaluateJson(port, pluginLogScript(), logLinesSchema),
	);
	const warnings = parseOffMainWarnings(logLines, since);
	const errors = withoutSelfTest(parsePluginErrors(logLines, since));
	const skippedHooks = parseSkippedHooks(logLines, since);

	timings.lap('logs');
	writeFileSync(join(out, 'timing.json'), `${JSON.stringify(timings.result(), null, '\t')}\n`);

	await restoreDevice();

	for (const check of checks) {
		const name = catalog.find((plugin) => plugin.id === check.id)?.name;
		const calls = name ? warnings.get(name) : undefined;

		if (calls?.length) check.offMainCalls = calls;

		const logged = name ? errors.get(name) : undefined;

		if (logged?.length) check.errors = logged;

		const skipped = name ? skippedHooks.get(name) : undefined;

		if (skipped?.length) check.skippedHooks = skipped;
	}

	const baseline = readBaseline(
		values.baseline ? resolve(values.baseline) : join(out, 'results.json'),
	);

	const compared = baseline?.filter((check) => !only || only.has(check.id));

	checks.splice(0, checks.length, ...applyLogPolicy(checks, compared, !values.lenient));

	const saved = only && baseline ? mergeChecks(baseline, checks) : checks;

	writeFileSync(join(out, 'results.json'), `${JSON.stringify(saved, null, '\t')}\n`);
	writeEnvironment(out, environment);

	if (checks.every((check) => check.behavior === 'pass' && check.lifecycle === 'pass')) {
		keepGoodScreens(out, SETTINGS_SCREEN_SUFFIX);
	}

	if (compared) {
		const changes = compareRuns(compared, checks);

		writeFileSync(join(out, 'changes.md'), `${renderChanges(changes)}\n`);

		for (const change of changes) console.error(`changed: ${change}`);
	}

	for (const change of screenChanges) console.error(`changed: ${change}`);
	writeFileSync(
		join(out, 'matrix.md'),
		`${renderDeviceMatrix(catalog, checks, values.device ?? (target.kind === 'ios' ? 'iOS' : 'Android'))}\n`,
	);
	console.log(join(out, 'matrix.md'));
}

if (import.meta.main) await main();
