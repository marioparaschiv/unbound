import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type { MeasuredCheck } from './compare-device-matrix';
import { openDevice } from './device';
import { describeMemory, describeSpringBoard, largestGrowers } from './device-memory';
import { runDevice, type DeviceRun } from './device-run';
import { describeTimings } from './timings';
import { MATRIX_CONFIG_PATH, deviceSlug, readMatrixConfig } from './matrix-config';

export type { DeviceRun } from './device-run';

function passed(check: MeasuredCheck): boolean {
	return check.behavior === 'pass' && check.lifecycle === 'pass';
}

function cell(check: MeasuredCheck | undefined): string {
	if (!check) return '—';

	return passed(check) ? 'pass' : `**fail**: ${check.note ?? 'failed'}`;
}

const LISTED_CALLS = 6;
const PLACEMENT_LISTED = 5;

export function listCalls(calls: string[]): string {
	const listed = calls.slice(0, LISTED_CALLS).map((call) => `\`${call}\``);
	const more = calls.length - listed.length;

	return more > 0 ? `${listed.join(', ')} and ${more} more` : listed.join(', ');
}

function slowest(
	run: DeviceRun,
	label: string,
	time: (check: MeasuredCheck) => number | undefined,
): string[] {
	const timed = run.checks
		.filter((check) => time(check) !== undefined)
		.sort((a, b) => time(b)! - time(a)!)
		.slice(0, PLACEMENT_LISTED)
		.map((check) => `${check.id} ${time(check)} ms`);

	return timed.length ? [`- ${run.device.name}, ${label}: ${timed.join(', ')}`] : [];
}

export function renderSummary(runs: DeviceRun[]): string {
	const ids = [...new Set(runs.flatMap((run) => run.checks.map((check) => check.id)))].sort();
	const totals = runs.map((run) => {
		const passing = run.checks.filter(passed).length;
		const outcome = run.error ?? `${passing}/${run.checks.length} passed`;

		return `- **${run.device.name}:** ${outcome}`;
	});
	const failing = ids.filter((id) =>
		runs.some((run) => {
			const check = run.checks.find((candidate) => candidate.id === id);

			return check && !passed(check);
		}),
	);
	const header = `| Plugin | ${runs.map((run) => run.device.name).join(' | ')} |`;
	const divider = `| --- | ${runs.map(() => '---').join(' | ')} |`;
	const rows = failing.map(
		(id) =>
			`| ${id} | ${runs.map((run) => cell(run.checks.find((check) => check.id === id))).join(' | ')} |`,
	);
	const offMain = runs.flatMap((run) =>
		run.checks
			.filter((check) => check.offMainCalls?.length)
			.map((check) => `- ${run.device.name}, ${check.id}: ${listCalls(check.offMainCalls!)}`),
	);
	const errors = runs.flatMap((run) =>
		run.checks
			.filter((check) => check.errors?.length)
			.map((check) => `- ${run.device.name}, ${check.id}: ${check.errors!.join('; ')}`),
	);
	const skipped = runs.flatMap((run) =>
		run.checks
			.filter((check) => check.skippedHooks?.length)
			.map((check) => `- ${run.device.name}, ${check.id}: ${listCalls(check.skippedHooks!)}`),
	);
	const changes = runs.flatMap((run) =>
		run.changes.map((change) => `- ${run.device.name}: ${change}`),
	);
	const visual = runs.flatMap((run) =>
		run.checks
			.filter((check) => check.visualProblems?.length)
			.map(
				(check) => `- ${run.device.name}, ${check.id}: ${check.visualProblems!.join('; ')}`,
			),
	);
	const toasts = runs
		.filter((run) => run.scrollToasts?.length)
		.map((run) => `- ${run.device.name}: ${run.scrollToasts!.join(', ')}`);
	const loader = runs
		.filter((run) => run.selfTest)
		.map(
			(run) =>
				`- ${run.device.name}: ${run.selfTest!.ok ? 'pass' : '**fail**'}, ${run.selfTest!.detail}`,
		);
	const loaderFailed = runs.some((run) => run.selfTest?.ok === false);
	const memory = runs.flatMap((run) => {
		const line = run.memory ? describeMemory(run.memory) : undefined;
		const growers = largestGrowers(run.checks);
		const detail = growers.length
			? `; largest swings during a plugin cycle, not kept (the leak check measures what is): ${growers.join(', ')}`
			: '';

		const springBoard = run.memory?.springBoard
			? [`- ${run.device.name}: ${describeSpringBoard(run.memory.springBoard)}`]
			: [];

		return [...(line ? [`- ${run.device.name}: ${line}${detail}`] : []), ...springBoard];
	});
	const leaks = runs.flatMap((run) => {
		const measured = run.checks
			.filter((check) => check.leakPerCycleMB !== undefined)
			.sort((a, b) => (b.leakPerCycleMB ?? 0) - (a.leakPerCycleMB ?? 0))
			.slice(0, 3)
			.map((check) => `${check.id} ${check.leakPerCycleMB} MB`);

		return measured.length
			? [`- ${run.device.name}, most growth per cycle: ${measured.join(', ')}`]
			: [];
	});
	const placement = runs.flatMap((run) => [
		...slowest(run, 'slowest to draw', (check) => check.metrics?.drawnMs),
		...slowest(run, 'slowest to redraw after scrolling', (check) => check.redrawMs),
	]);
	const durations = runs
		.filter((run) => run.timings)
		.map((run) => `- ${run.device.name}: ${describeTimings(run.timings!)}`);
	const dropped = runs.flatMap((run) =>
		(run.drops ?? []).map((drop) => `- ${run.device.name}, during ${drop}`),
	);
	const stuck = runs
		.filter((run) => run.scrollStuck)
		.map((run) => `- ${run.device.name}: the swipes did not move the message list`);
	const empty = runs
		.filter((run) => run.emptyToasts?.length)
		.map((run) => `- ${run.device.name}: ${run.emptyToasts!.join(', ')}`);

	return [
		'## Device matrix',
		'',
		...totals,
		...(rows.length ? ['', header, divider, ...rows] : []),
		...(!rows.length &&
		!toasts.length &&
		!empty.length &&
		!stuck.length &&
		!loaderFailed &&
		runs.every((run) => !run.error)
			? ['', 'Every plugin passed on every device.']
			: []),
		...(loader.length ? ['', '### Loader self-test', '', ...loader] : []),
		...(visual.length ? ['', '### Visual problems', '', ...visual] : []),
		...(toasts.length ? ['', '### Toasts while scrolling', '', ...toasts] : []),
		...(empty.length ? ['', '### Empty toasts', '', ...empty] : []),
		...(stuck.length ? ['', '### Scrolling', '', ...stuck] : []),
		...(dropped.length ? ['', '### Device drops', '', ...dropped] : []),
		...(memory.length ? ['', '### Discord memory over the run', '', ...memory] : []),
		...(leaks.length ? ['', '### Leak check', '', ...leaks] : []),
		...(placement.length ? ['', '### Placement time', '', ...placement] : []),
		...(durations.length ? ['', '### Duration', '', ...durations] : []),
		...(offMain.length ? ['', '### Off-main view calls', '', ...offMain] : []),
		...(errors.length ? ['', '### Plugin errors', '', ...errors] : []),
		...(skipped.length
			? ['', '### Hooks skipped while JavaScript was busy', '', ...skipped]
			: []),
		...(changes.length ? ['', '### Changes since the last run', '', ...changes] : []),
	].join('\n');
}

export function runFailed(run: DeviceRun): boolean {
	return Boolean(
		run.error ||
		run.selfTest?.ok === false ||
		run.scrollStuck ||
		run.scrollToasts?.length ||
		run.emptyToasts?.length ||
		!run.checks.every(passed),
	);
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		options: {
			config: { type: 'string', default: MATRIX_CONFIG_PATH },
			out: { type: 'string' },
			only: { type: 'string' },
			channel: { type: 'string' },
			lenient: { type: 'boolean' },
			'leak-cycles': { type: 'string' },
			'full-leak-check': { type: 'boolean' },
			'clear-staged': { type: 'boolean' },
		},
	});
	const config = readMatrixConfig(resolve(values.config));

	if (!config?.devices.length || !values.out) {
		throw new Error(
			`Usage: bun packages/plugin-scripts/src/run-device-matrix.ts --out <dir> [--only <id,id>] [--channel <guild id>/<channel id>] [--lenient] [--leak-cycles <n>] [--full-leak-check] [--clear-staged] [--config ${MATRIX_CONFIG_PATH}], with the devices listed in the config.`,
		);
	}

	const out = resolve(values.out);
	const options = {
		channel: values.channel ?? config.channel,
		only: values.only?.split(','),
		lenient: values.lenient,
		leakCycles: Number(values['leak-cycles'] ?? 0),
		fullLeakCheck: values['full-leak-check'],
		clearStaged: values['clear-staged'],
	};

	mkdirSync(out, { recursive: true });

	// Each device runs in this process; its report is the returned run, and run.json in its folder.
	const runs = await Promise.all(
		config.devices.map(async (matrixDevice) => {
			const device = openDevice(matrixDevice);

			try {
				return await runDevice(device, {
					...options,
					out: join(out, deviceSlug(matrixDevice)),
				});
			} finally {
				device.close();
			}
		}),
	);
	const summary = renderSummary(runs);

	writeFileSync(join(out, 'summary.md'), `${summary}\n`);
	console.log(summary);

	if (runs.some(runFailed)) process.exitCode = 1;
}

if (import.meta.main) await main();
