import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { join } from 'node:path';

import { benchEnvironment, runDoctor, type BenchEnvironment } from '~/bench/environment';
import { planFromFile, planFromRefs, type Plan, type Protocol } from '~/bench/plan';
import { renderReport, runsCsv, summaryCsv, summaryRows } from '~/bench/report';
import { prepareDevice, restoreDevice, runBlocks } from '~/bench/runner';
import { buildVariant, type VariantBuild } from '~/bench/build';
import type { DiscordBuild, RunRecord } from '~/bench/record';
import type { LaunchContext } from '~/bench/launch';
import { startBenchServer } from '~/bench/server';
import { createContext } from '~/lib/context';
import { devicePaths } from '~/bench/device';
import { acquireLock } from '~/bench/lock';
import { Vphone } from '~/bench/vphone';

const USAGE = `usage: bun run bench <ref> <ref> [...] [--rounds 3] [--warm 2] [--cold 1] [--idle-ms 25000] [--addons none|all]
       bun run bench --variants <file.json> [overrides]
       bun run bench --build-only <ref> ...
       bun run bench --restore`;

const REPO = join(import.meta.dir, '../../../..');

function print(line: string): void {
	console.log(`${new Date().toISOString().slice(11, 19)} ${line}`);
}

function readPlan(values: Record<string, string | boolean | undefined>, refs: string[]): Plan {
	const protocol: Partial<Protocol> = {};

	for (const [flag, key] of [
		['rounds', 'rounds'],
		['warm', 'warm'],
		['cold', 'cold'],
		['idle-ms', 'idleMs'],
	] as const) {
		if (typeof values[flag] === 'string') {
			protocol[key] = Number(values[flag]);
		}
	}

	if (values.addons === 'none' || values.addons === 'all') {
		protocol.addons = values.addons;
	} else if (values.addons !== undefined) {
		throw new Error(`--addons is none or all, not ${String(values.addons)}.\n${USAGE}`);
	}

	if (typeof values.variants === 'string') {
		const plan = planFromFile(JSON.parse(readFileSync(values.variants, 'utf8')), protocol);

		if ('error' in plan) {
			throw new Error(plan.error);
		}

		return plan;
	}

	if (refs.length === 0) {
		throw new Error(USAGE);
	}

	return planFromRefs(refs, protocol);
}

function deviations(origin: string, plan: Plan): string[] {
	return [
		'The loader is built with `ATTESTATION_ENABLED=0` and no bundle signing key. A release has attestation on and verifies the signed bundle manifest; that check runs only when a new bundle downloads, which happens in discarded warm-ups.',
		`Bundles come from the bench's CDN stand-in at ${origin} (strong ETags, 304s), not builds.unbound.rip.`,
		'The debugger stays enabled so the samples can run; the client dials the bridge after init and each sample is one eval.',
		'Hot reload is off (`loader.update.hmr` false, the release default): the loader runs its cached bundle and checks for updates in the background.',
		plan.addons === 'all'
			? "Only the variant's first-party iOS plugins are installed, all enabled, staged as published (Hermes bytecode with its digest in the manifest)."
			: 'Addons are off: the Plugins, Themes, Icons and Fonts folders are empty, and no theme, icon pack or font override is applied.',
		'Discord runs on the vphone, an iOS VM, not a phone.',
	];
}

function unmeasured(records: RunRecord[], plan: Plan): string[] {
	const lines = ['Unbound module-cache hits and misses: the client does not count them.'];

	if (
		records.length > 0 &&
		plan.addons === 'all' &&
		records.every((r) => r.pluginStartMs === null)
	) {
		lines.push(
			"Per-plugin `start()` time: no variant's client exposes `unbound.plugins.startDurations`.",
		);
	}

	if (records.length > 0 && records.every((r) => !r.memory.idle?.hermes)) {
		lines.push('Hermes heap counters: `HermesInternal.getInstrumentedStats` was unavailable.');
	}

	return lines;
}

function writeOutputs(
	out: string,
	startedAt: string,
	plan: Plan,
	builds: VariantBuild[],
	records: RunRecord[],
	discord: DiscordBuild,
	origin: string,
): void {
	const input = {
		startedAt,
		plan,
		builds,
		records,
		discord,
		deviations: deviations(origin, plan),
		unmeasured: unmeasured(records, plan),
	};

	writeFileSync(join(out, 'runs.csv'), runsCsv(records));
	writeFileSync(join(out, 'summary.csv'), summaryCsv(summaryRows(plan, records)));
	writeFileSync(join(out, 'report.md'), renderReport(input));
	writeFileSync(
		join(out, 'meta.json'),
		JSON.stringify(
			{ startedAt, plan, builds, discord, deviations: input.deviations },
			null,
			'\t',
		),
	);
}

async function build(environment: BenchEnvironment, plan: Plan): Promise<VariantBuild[]> {
	const builds: VariantBuild[] = [];

	for (const variant of plan.variants)
		builds.push(await buildVariant(REPO, environment.cache, variant, plan.addons, print));

	return builds;
}

async function main(): Promise<void> {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			variants: { type: 'string' },
			rounds: { type: 'string' },
			warm: { type: 'string' },
			cold: { type: 'string' },
			'idle-ms': { type: 'string' },
			addons: { type: 'string' },
			'build-only': { type: 'boolean' },
			restore: { type: 'boolean' },
			help: { type: 'boolean' },
		},
	});

	if (values.help) {
		return console.log(USAGE);
	}

	const environment = benchEnvironment(REPO);
	const controller = new AbortController();
	let interrupts = 0;

	function interrupt() {
		interrupts++;

		if (interrupts === 1) {
			print(
				'Interrupted: finishing up and restoring the device. Ctrl-C twice more to leave it as it is.',
			);
			controller.abort(new Error('Interrupted'));
		} else if (interrupts >= 3) {
			print(
				'Left the device in its bench state; run `bun run bench --restore` to put it back.',
			);
			process.exit(130);
		}
	}

	process.on('SIGINT', interrupt);
	process.on('SIGTERM', interrupt);

	const plan = values.restore ? undefined : readPlan(values, positionals);
	const builds = plan ? await build(environment, plan) : [];

	if (values['build-only'] || controller.signal.aborted) return;

	const release = await acquireLock(controller.signal, (owner) =>
		print(`Waiting for the vphone lock, held by ${owner}`),
	);
	const vphone = new Vphone(environment.connector, environment.tailnetUrl);
	const bridge = createContext(environment.bridgePort);

	try {
		print(`Took the vphone lock. Doctor:\n${await runDoctor(REPO, Boolean(plan))}`);

		if (!plan) {
			print(
				(await restoreDevice({ vphone, client: bridge.client }, print))
					? 'Unbound is back on the bridge.'
					: 'Unbound did not answer on the bridge after the restore.',
			);

			return;
		}

		const info = await vphone.appInfo();
		const discord = { version: info.version, build: info.build };
		const server = startBenchServer(environment.devHost, environment.benchPort);
		const startedAt = new Date().toISOString();
		const out = join(environment.out, startedAt.replaceAll(':', '').replace(/\.\d+Z$/, 'Z'));
		const records: RunRecord[] = [];
		const context: LaunchContext = {
			vphone,
			server,
			paths: devicePaths(info),
			client: bridge.client,
			discord,
			idleMs: plan.idleMs,
			addons: plan.addons,
			signal: controller.signal,
		};

		mkdirSync(out, { recursive: true });
		print(
			`Discord ${discord.version} (${discord.build}), addons ${plan.addons}; writing to ${out}`,
		);

		try {
			await prepareDevice(context, builds, print);
			await runBlocks(
				context,
				plan,
				new Map(builds.map((b) => [b.variant, b])),
				(record) => {
					records.push(record);
					appendFileSync(join(out, 'runs.jsonl'), JSON.stringify(record) + '\n');
				},
				print,
			);
		} catch (error) {
			print(`Stopped: ${error instanceof Error ? error.message : String(error)}`);
			process.exitCode = 1;
		} finally {
			const back = await restoreDevice(context, print).catch((error: Error) => {
				print(
					`Failed to restore the device: ${error.message}. Run \`bun run bench --restore\`.`,
				);

				return false;
			});

			server.stop();
			writeOutputs(out, startedAt, plan, builds, records, discord, server.origin);
			print(
				`${back ? 'Device restored.' : 'Device NOT confirmed restored.'} Doctor:\n${await runDoctor(REPO, false)}`,
			);
			print(
				`Report: ${join(out, 'report.md')}${environment.publicUrl ? `\n  ${environment.publicUrl}/${out.split('/').at(-1)}/report.md` : ''}`,
			);
		}
	} finally {
		bridge.close();
		await vphone.close();
		release();
	}
}

await main().catch((error: Error) => {
	console.error(error.message);
	process.exit(1);
});
