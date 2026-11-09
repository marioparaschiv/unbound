// Benchmarks client builds on a rooted Android emulator: startup marks, JS-thread stalls, Hermes heap, process memory
// and which client and Discord modules each part of the app loads. See README.md.
import { cpSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { join } from 'node:path';

import { createDevice, sha256, type MemInfo } from './device';
import { renderReport, type LaunchRecord } from './report';
import { startServer, type AgentReport } from './server';

const ROOT = join(import.meta.dir, '..', '..');
const SHIPPED = ['manifest.json', 'unbound.98.bundle', 'unbound.js'];

const { values } = parseArgs({
	options: {
		variant: { type: 'string', multiple: true },
		rounds: { type: 'string', default: '4' },
		'per-block': { type: 'string', default: '2' },
		'idle-ms': { type: 'string', default: '20000' },
		'step-ms': { type: 'string', default: '3000' },
		'no-trace': { type: 'boolean', default: false },
		'no-scenario': { type: 'boolean', default: false },
		plugins: { type: 'string', default: 'off' },
		port: { type: 'string', default: '3390' },
		serial: { type: 'string', default: process.env.AVD_SERIAL ?? 'emulator-5554' },
		out: { type: 'string' },
		'report-only': { type: 'string' },
		'skip-build': { type: 'boolean', default: false },
	},
});

/** One build to compare: a name and the environment it builds with. */
type Variant = { name: string; env: Record<string, string> };

/** What a variant built into, and how the harness proves it ran. */
type Build = Variant & { folder: string; bundleSha256: string; sizes: Record<string, number> };

function print(line: string) {
	console.log(`${new Date().toISOString().slice(11, 19)} ${line}`);
}

function parseVariant(spec: string): Variant {
	const [name = '', env = ''] = spec.split(':');
	const pairs = env
		.split(',')
		.filter(Boolean)
		.map((pair) => pair.split('=') as [string, string]);

	if (!/^[\w-]+$/.test(name)) {
		throw new Error(
			`Variant "${spec}" needs a name of letters, digits, - and _: name[:KEY=VALUE,...]`,
		);
	}

	return { name, env: Object.fromEntries(pairs) };
}

async function build(variant: Variant, out: string, port: number): Promise<Build> {
	const folder = join(out, 'builds', variant.name);
	const log = join(out, 'builds', `${variant.name}.log`);

	mkdirSync(folder, { recursive: true });

	if (!values['skip-build'] || !existsSync(join(folder, 'unbound.98.bundle'))) {
		print(`${variant.name}: building (${JSON.stringify(variant.env)}); log ${log}`);

		const child = Bun.spawn(['bun', 'run', 'build'], {
			cwd: ROOT,
			env: {
				...process.env,
				UNBOUND_CHANNEL: 'beta',
				UNBOUND_BENCH: '1',
				UNBOUND_BENCH_VARIANT: variant.name,
				UNBOUND_BENCH_REPORT: `http://10.0.2.2:${port}/report`,
				UNBOUND_BENCH_TRACE: values['no-trace'] ? '0' : '1',
				UNBOUND_BENCH_SCENARIO: values['no-scenario'] ? '0' : '1',
				UNBOUND_BENCH_IDLE_MS: values['idle-ms'],
				UNBOUND_BENCH_STEP_MS: values['step-ms'],
				...variant.env,
			},
			stdout: 'pipe',
			stderr: 'pipe',
		});
		const text =
			(await new Response(child.stdout).text()) + (await new Response(child.stderr).text());

		writeFileSync(log, text);

		if ((await child.exited) !== 0) {
			throw new Error(`Failed to build ${variant.name}; log ${log}`);
		}

		for (const file of SHIPPED) {
			cpSync(join(ROOT, 'dist', file), join(folder, file));
		}
	}

	const sizes = Object.fromEntries(
		SHIPPED.map((file) => [file, statSync(join(folder, file)).size]),
	);

	return {
		...variant,
		folder,
		bundleSha256: sha256(readFileSync(join(folder, 'unbound.98.bundle'))),
		sizes,
	};
}

// UNKNOWN: settings.json is the loader's and every store's; only the keys the bench owns are touched.
function benchSettings(original: string, url: string): string {
	const settings = JSON.parse(original);
	const unbound = (settings.unbound ??= {});

	unbound.loader ??= {};
	unbound.loader.update = { ...unbound.loader.update, url, hmr: false };
	unbound.debugger = { ...unbound.debugger, enabled: false };
	unbound['developer-mode'] = false;

	if (values.plugins === 'off') {
		const states = settings.plugins?.states ?? {};

		for (const id of Object.keys(states)) states[id] = false;
	}

	return JSON.stringify(settings);
}

function agentProblems(agent: AgentReport | null): string[] {
	if (!agent) {
		return [];
	}

	const problems: string[] = [];

	if (agent.marks['initialize:end'] === undefined) {
		problems.push('Unbound failed to initialize');
	}

	for (const window of agent.windows) {
		const screen = /^UNBOUND_[A-Z_]+$/.test(window.name);

		if (window.error) {
			problems.push(`${window.name} threw: ${window.error}`);
		}

		if (screen && window.route !== window.name) {
			problems.push(`${window.name} showed ${window.route ?? 'no route'}`);
		}
	}

	return problems;
}

async function main() {
	if (values['report-only']) {
		const dir = values['report-only'];
		const data = JSON.parse(readFileSync(join(dir, 'records.json'), 'utf8'));

		writeFileSync(join(dir, 'report.md'), renderReport(data.builds, data.records));
		print(`report: ${join(dir, 'report.md')}`);

		return;
	}

	const variants = (values.variant ?? []).map(parseVariant);

	if (variants.length < 1) {
		throw new Error(
			'Pass at least one --variant name[:KEY=VALUE,...]; the first is the baseline.',
		);
	}

	const port = Number(values.port);
	const rounds = Number(values.rounds);
	const perBlock = Number(values['per-block']);
	const idleMs = Number(values['idle-ms']);
	const out =
		values.out ?? join('/tmp/ubd-bench', new Date().toISOString().replace(/[:.]/g, '-'));
	const adb = join(
		process.env.ANDROID_HOME ?? join(process.env.HOME ?? '', 'android-sdk'),
		'platform-tools',
		'adb',
	);
	const device = createDevice(adb, values.serial);

	mkdirSync(join(out, 'runs'), { recursive: true });

	if (!(await device.isRoot())) {
		throw new Error(
			`${values.serial} has no root adb shell; run \`adb -s ${values.serial} root\`.`,
		);
	}

	const builds: Build[] = [];

	for (const variant of variants) {
		builds.push(await build(variant, out, port));
	}

	const records: LaunchRecord[] = [];
	let expecting: { variant: string; resolve: (report: AgentReport) => void } | undefined;
	let idleMem: MemInfo | undefined;

	const stopServer = startServer(
		port,
		new Map(builds.map((b) => [b.name, b.folder])),
		async (report) => {
			if (!expecting || report.variant !== expecting.variant) return;

			if (report.phase === 'idle') {
				idleMem = await device.memInfo();
			}

			if (report.phase === 'final') {
				expecting.resolve(report);
			}
		},
	);

	const original = await device.readSettings();
	let restored = false;

	writeFileSync(join(out, 'settings.backup.json'), original);

	async function restore() {
		if (restored) return;

		restored = true;
		stopServer();
		await device.stop();
		await device.writeSettings(original);
		// With no saved bundle the loader waits for the dev server's and runs it, rather than one more bench bundle.
		await device.clearBundle();
		await device.launch();
		print(
			`restored settings.json and relaunched Discord (backup ${join(out, 'settings.backup.json')})`,
		);
	}

	process.on('SIGINT', () => void restore().finally(() => process.exit(130)));

	const timeoutMs = idleMs + 120_000;

	async function switchTo(b: Build) {
		await device.stop();
		await device.writeSettings(benchSettings(original, `http://10.0.2.2:${port}/${b.name}/`));

		if ((await device.bundleSha256()) === b.bundleSha256) return;

		// With no saved bundle the loader waits for the download and runs it; later launches run it from the cache.
		print(`${b.name}: warm-up launch to download its bundle`);
		await device.clearBundle();
		await device.launch();

		const deadline = Date.now() + 120_000;

		while ((await device.bundleSha256()) !== b.bundleSha256) {
			if (Date.now() > deadline) {
				throw new Error(`The device never downloaded ${b.name}'s bundle.`);
			}

			await sleep(2_000);
		}

		await sleep(8_000);
		await device.stop();
	}

	async function measure(b: Build, index: number): Promise<LaunchRecord> {
		await device.stop();
		await sleep(2_000);

		idleMem = undefined;

		const final = new Promise<AgentReport | undefined>((resolve) => {
			expecting = { variant: b.name, resolve };
			setTimeout(() => resolve(undefined), timeoutMs);
		});

		await device.launch();

		let pid: number | undefined;

		for (let i = 0; i < 50 && !pid; i++) {
			pid = await device.pid();

			if (!pid) {
				await sleep(100);
			}
		}

		const processStart = pid ? await device.processStartEpoch(pid) : undefined;
		const report = await final;
		const finalMem = report ? await device.memInfo() : undefined;
		const endPid = await device.pid();
		const problems: string[] = [];

		expecting = undefined;

		if (!report) {
			problems.push(`no final report within ${timeoutMs / 1000} s`);
		}

		if (pid && !processStart) {
			problems.push(`process ${pid} exited before its start time was read: crash`);
		}

		if (!pid || pid !== endPid) {
			problems.push(`Discord's process changed (${pid} → ${endPid}): crash`);
		}

		if ((await device.bundleSha256()) !== b.bundleSha256) {
			problems.push('the device ran another bundle');
		}

		const agent = report ?? null;

		problems.push(...agentProblems(agent));

		return {
			variant: b.name,
			index,
			processStart: processStart ?? null,
			agent,
			memory: { idle: idleMem ?? null, final: finalMem ?? null },
			problems,
		};
	}

	try {
		let index = 0;

		for (let round = 0; round < rounds; round++) {
			// Alternating the order cancels drift on a shared host: A B, B A, A B, ...
			const order = round % 2 ? builds.toReversed() : builds;

			for (const b of order) {
				await switchTo(b);

				for (let i = 0; i < perBlock; i++) {
					const record = await measure(b, index++);

					records.push(record);
					writeFileSync(
						join(out, 'runs', `${record.index}-${b.name}.json`),
						JSON.stringify(record),
					);
					print(
						`#${record.index} ${b.name}: ${record.problems.length ? `INVALID ${record.problems.join('; ')}` : 'ok'}`,
					);
				}
			}

			writeFileSync(join(out, 'records.json'), JSON.stringify({ builds, records }));
		}
	} finally {
		await restore();
	}

	writeFileSync(join(out, 'records.json'), JSON.stringify({ builds, records }));
	writeFileSync(join(out, 'report.md'), renderReport(builds, records));
	print(`report: ${join(out, 'report.md')}`);
}

await main();
