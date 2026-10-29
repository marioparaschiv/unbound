import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type { MeasuredCheck } from './compare-device-matrix';
import {
	MATRIX_CONFIG_PATH,
	collectorArgs,
	deviceSlug,
	readMatrixConfig,
	type MatrixDevice,
} from './matrix-config';

export type DeviceRun = {
	device: MatrixDevice;
	checks: MeasuredCheck[];
	changes: string[];
	scrollToasts?: string[];
	emptyToasts?: string[];
	scrollStuck?: boolean;
	drops?: string[];
	error?: string;
};

type ScrollResult = { swipes: number; moved?: boolean; toasts: string[]; emptyToasts?: string[] };

const COLLECTOR = resolve(import.meta.dir, 'collect-device-matrix.ts');

function passed(check: MeasuredCheck): boolean {
	return check.behavior === 'pass' && check.lifecycle === 'pass';
}

function cell(check: MeasuredCheck | undefined): string {
	if (!check) return '—';

	return passed(check) ? 'pass' : `**fail**: ${check.note ?? 'failed'}`;
}

const LISTED_CALLS = 6;

export function failureReason(lines: string[]): string | undefined {
	const errors = lines.filter(
		(line) => line.startsWith('error: ') && !line.includes('exited with code'),
	);

	return errors.at(-1)?.slice('error: '.length) ?? lines.filter(Boolean).at(-1);
}

export function listCalls(calls: string[]): string {
	const listed = calls.slice(0, LISTED_CALLS).map((call) => `\`${call}\``);
	const more = calls.length - listed.length;

	return more > 0 ? `${listed.join(', ')} and ${more} more` : listed.join(', ');
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
	const toasts = runs
		.filter((run) => run.scrollToasts?.length)
		.map((run) => `- ${run.device.name}: ${run.scrollToasts!.join(', ')}`);
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
		runs.every((run) => !run.error)
			? ['', 'Every plugin passed on every device.']
			: []),
		...(toasts.length ? ['', '### Toasts while scrolling', '', ...toasts] : []),
		...(empty.length ? ['', '### Empty toasts', '', ...empty] : []),
		...(stuck.length ? ['', '### Scrolling', '', ...stuck] : []),
		...(dropped.length ? ['', '### Device drops', '', ...dropped] : []),
		...(offMain.length ? ['', '### Off-main view calls', '', ...offMain] : []),
		...(errors.length ? ['', '### Plugin errors', '', ...errors] : []),
		...(skipped.length
			? ['', '### Hooks skipped while JavaScript was busy', '', ...skipped]
			: []),
		...(changes.length ? ['', '### Changes since the last run', '', ...changes] : []),
	].join('\n');
}

function readScroll(out: string): ScrollResult | undefined {
	const file = join(out, 'scroll.json');

	return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as ScrollResult) : undefined;
}

export function runFailed(run: DeviceRun): boolean {
	return Boolean(
		run.error ||
		run.scrollToasts?.length ||
		run.emptyToasts?.length ||
		!run.checks.every(passed),
	);
}

function readChecks(out: string): MeasuredCheck[] {
	const file = join(out, 'results.json');

	return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as MeasuredCheck[]) : [];
}

async function collect(
	device: MatrixDevice,
	out: string,
	channel: string | undefined,
	only: string | undefined,
	lenient = false,
): Promise<DeviceRun> {
	mkdirSync(out, { recursive: true });
	rmSync(join(out, 'scroll.json'), { force: true });

	const args = [...collectorArgs(device, out, channel, only), ...(lenient ? ['--lenient'] : [])];
	const child = Bun.spawn(['bun', COLLECTOR, ...args], {
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [stderr, exit] = await Promise.all([new Response(child.stderr).text(), child.exited]);
	const lines = stderr.split('\n');
	const changes = lines
		.filter((line) => line.startsWith('changed: '))
		.map((line) => line.slice('changed: '.length));
	const drops = lines
		.filter((line) => line.startsWith('dropped: '))
		.map((line) => line.slice('dropped: '.length));
	const ids = new Set(only?.split(','));
	const checks = readChecks(out).filter((check) => !only || ids.has(check.id));

	const scroll = readScroll(out);
	const toasts = {
		drops,
		scrollToasts: scroll?.toasts,
		emptyToasts: scroll?.emptyToasts,
		scrollStuck: scroll?.moved === false,
	};

	if (exit !== 0) {
		const reason = failureReason(lines) ?? `exited with ${exit}`;

		return { device, checks, changes, ...toasts, error: `collector failed: ${reason}` };
	}

	return { device, checks, changes, ...toasts };
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		options: {
			config: { type: 'string', default: MATRIX_CONFIG_PATH },
			out: { type: 'string' },
			only: { type: 'string' },
			channel: { type: 'string' },
			lenient: { type: 'boolean' },
		},
	});
	const config = readMatrixConfig(resolve(values.config));

	if (!config?.devices.length || !values.out) {
		throw new Error(
			`Usage: bun packages/plugin-scripts/src/run-device-matrix.ts --out <dir> [--only <id,id>] [--channel <guild id>/<channel id>] [--lenient] [--config ${MATRIX_CONFIG_PATH}], with the devices listed in the config.`,
		);
	}

	const out = resolve(values.out);
	const channel = values.channel ?? config.channel;
	const runs = await Promise.all(
		config.devices.map((device) =>
			collect(device, join(out, deviceSlug(device)), channel, values.only, values.lenient),
		),
	);
	const summary = renderSummary(runs);

	writeFileSync(join(out, 'summary.md'), `${summary}\n`);
	console.log(summary);

	if (runs.some(runFailed)) process.exitCode = 1;
}

if (import.meta.main) await main();
