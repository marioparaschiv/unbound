#!/usr/bin/env bun
// Relaunches Discord on the vphone and waits until Unbound runs.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { appPid, DISCORD, HubError, retryAx, Vphone } from './vphone.ts';
import { readWindow, summariseLog } from './unbound-log.ts';
import { listCrashes, summarise } from './crashes.ts';

/** Printed by --help and on a bad argument. */
const USAGE = `Relaunches Discord on the vphone and waits until Unbound runs, surviving the usual failure modes: \`terminate\`
leaving the process alive, \`launch\` only foregrounding it, AX errors right after launch, the "Missing Safari
Extension" alert, and Discord dying while it starts (it explains the crash, or shows the run's log, and retries).
  relaunch [--stale] [--timeout <s>] [--attempts <n>] [--force]
  --stale     accept any Unbound build, not only the served checkout's (skips ready.sh --fresh)
  --timeout   seconds to wait for Unbound per attempt (default 60)
  --attempts  launches before giving up when Discord dies (default 2)
  --force     relaunch even while another agent holds the vphone lock
Exit 0: Unbound is up. 1: it never came up, diagnosis printed. 2: the hub is unreachable. 3: the vphone is locked.`;

type Options = { fresh: boolean; timeout: number; attempts: number; force: boolean };
type ReadyResult = { ok: boolean; crashed: boolean; text: string };

const HERE = import.meta.dir;
const LOCK_OWNER = join(process.env.VPHONE_LOCK ?? '/tmp/unbound-vphone.lock', 'owner');
const EVIDENCE = '/tmp/ubd-vphone';

/** Failure text the device can show instead of a running Unbound, with what each one means. */
const KNOWN_SCREENS: [RegExp, string][] = [
	[
		/Unbound failed to initialize/i,
		'the served bundle crashed while starting: read the alert, fix the build, relaunch',
	],
	[/SECURITY WARNING/i, 'a release loader is installed: install the DEBUG=1 loader (setup.md)'],
	[/Log In|Welcome to Discord/i, 'Discord is logged out: log in (setup.md, From nothing step 6)'],
];

function parse(argv: string[]): Options {
	const options: Options = { fresh: true, timeout: 60, attempts: 2, force: false };

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];

		if (arg === '--stale') {
			options.fresh = false;
		} else if (arg === '--force') {
			options.force = true;
		} else if (arg === '--timeout') {
			options.timeout = Number(argv[++i]);
		} else if (arg === '--attempts') {
			options.attempts = Number(argv[++i]);
		} else {
			throw new Error(`Unexpected argument ${arg}\n\n${USAGE}`);
		}
	}

	return options;
}

function isAlive(pid: string): boolean {
	try {
		process.kill(Number(pid), 0);

		return true;
	} catch {
		// No such process: its lock is stale.
		return false;
	}
}

function lockHolder(): string | undefined {
	if (!existsSync(LOCK_OWNER)) {
		return undefined;
	}

	const owner = readFileSync(LOCK_OWNER, 'utf8').trim();
	const pid = /pid=(\d+)/.exec(owner)?.[1];
	const until = /until=(\d+)/.exec(owner)?.[1];
	const ours = owner.startsWith(`agent ${process.env.UNBOUND_CHECKOUT} `);
	const expired = until !== undefined && Number(until) * 1000 < Date.now();

	// This checkout's own claim (claim.sh), an expired claim or a dead holder does not block.
	if (ours || expired || (pid && !isAlive(pid))) {
		return undefined;
	}

	return owner || 'an unnamed driver';
}

const pid = (vphone: Vphone) => appPid(vphone, DISCORD);

async function deviceNow(vphone: Vphone): Promise<number> {
	return Number((await vphone.text('shell', { command: 'date +%s' })).trim());
}

async function stop(vphone: Vphone) {
	const old = await pid(vphone);

	if (!old) {
		return;
	}

	await vphone.text('terminate', { bundle_id: DISCORD }).catch(() => '');

	for (let i = 0; i < 10; i++) {
		if ((await pid(vphone)) !== old) {
			return;
		}

		if (i === 2) {
			await vphone.text('shell', { command: `kill -9 ${old}`, root: true }).catch(() => '');
		}

		await Bun.sleep(500);
	}

	throw new Error(`Failed to stop Discord: pid ${old} survives terminate and kill -9`);
}

/** Runs ready.sh while watching Discord's pid, and stops early when the process dies. */
async function waitReady(vphone: Vphone, livePid: number, options: Options): Promise<ReadyResult> {
	const args = [
		join(HERE, 'ready.sh'),
		'--timeout',
		String(options.timeout),
		...(options.fresh ? ['--fresh'] : []),
	];
	const ready = Bun.spawn(['bash', ...args], { stdout: 'pipe', stderr: 'pipe' });
	const output = Promise.all([
		new Response(ready.stdout).text(),
		new Response(ready.stderr).text(),
	]);
	let crashed = false;

	const watch = (async () => {
		while (ready.exitCode === null) {
			await Bun.sleep(2000);

			if (ready.exitCode === null && (await pid(vphone).catch(() => livePid)) !== livePid) {
				crashed = true;
				ready.kill();
			}
		}
	})();

	const code = await ready.exited;

	await watch;

	const [out, err] = await output;

	return { ok: code === 0 && !crashed, crashed, text: (out + err).trim() };
}

async function dismissAlerts(vphone: Vphone) {
	for (let i = 0; i < 4; i++) {
		const found = await retryAx(() =>
			vphone.text('wait', { text: 'Okay', match: 'exact', timeout: 3 }),
		).catch((error: Error) => error.message);

		if (!found.includes('"found": true')) {
			return;
		}

		await vphone.text('tap_text', { text: 'Okay', match: 'exact' }).catch(() => '');
	}
}

/** Screenshots the device, names any known failure screen and adds the doctor's FAIL lines. */
async function diagnose(vphone: Vphone): Promise<string> {
	mkdirSync(EVIDENCE, { recursive: true });

	const shot = join(EVIDENCE, `relaunch-${Date.now()}.png`);
	const image = (await vphone.call('screenshot')).content.find((part) => part.type === 'image');
	const screen = await retryAx(() => vphone.text('ui')).catch(() => '');
	const doctor = Bun.spawnSync(['bash', join(HERE, 'doctor.sh')]).stdout.toString();
	const lines: string[] = [];

	if (image?.data) {
		await Bun.write(shot, Buffer.from(image.data, 'base64'));
		lines.push(`screenshot: ${shot}`);
	}

	for (const [pattern, meaning] of KNOWN_SCREENS) {
		if (pattern.test(screen)) {
			lines.push(`screen shows ${pattern.source}: ${meaning}`);
		}
	}

	for (const line of doctor.split('\n')) {
		if (line.startsWith('FAIL')) {
			lines.push(`doctor: ${line}`);
		}
	}

	return lines.join('\n');
}

/** Explains why a launch died: its crash report, else the loader's log since the launch. */
async function explainDeath(vphone: Vphone, since: number): Promise<string> {
	await Bun.sleep(1500);

	const [report] = await listCrashes(vphone, since - 1);

	if (report) {
		return summarise(vphone, report);
	}

	// The device clock can run ahead of this machine's, so the window ends a minute late.
	const until = new Date(Date.now() + 60_000).toISOString();
	const window = await readWindow(vphone, new Date((since - 1) * 1000).toISOString(), until);

	return `no crash report was written (killed by the system or a watchdog?); unbound.log for it:\n${summariseLog(window, 8)}`;
}

async function launchOnce(vphone: Vphone): Promise<number | undefined> {
	await stop(vphone);
	await retryAx(() => vphone.text('launch', { bundle_id: DISCORD }));

	for (let i = 0; i < 20; i++) {
		const live = await pid(vphone);

		if (live) {
			return live;
		}

		await Bun.sleep(500);
	}

	return undefined;
}

async function main(options: Options): Promise<number> {
	const holder = lockHolder();

	if (holder && !options.force) {
		console.error(`vphone is locked by ${holder}; wait for it or pass --force`);

		return 3;
	}

	const vphone = new Vphone();

	try {
		for (let attempt = 1; attempt <= options.attempts; attempt++) {
			const since = await deviceNow(vphone);
			const live = await launchOnce(vphone);
			const result = live
				? await waitReady(vphone, live, options)
				: { ok: false, crashed: true, text: '' };

			if (result.ok) {
				await dismissAlerts(vphone);
				console.log(`Discord pid ${live}, attempt ${attempt}\n${result.text}`);

				return 0;
			}

			if (!result.crashed) {
				console.error(`${result.text}\n${await diagnose(vphone)}`);

				return 1;
			}

			console.error(
				`attempt ${attempt}: Discord ${live ? `pid ${live} died while starting` : 'never started'}`,
			);
			console.error(await explainDeath(vphone, since));
		}

		console.error(
			`Discord died on all ${options.attempts} attempts\n${await diagnose(vphone)}`,
		);

		return 1;
	} finally {
		vphone.close();
	}
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
	console.log(USAGE);
	process.exit(0);
}

Promise.resolve(process.argv.slice(2))
	.then((argv) => main(parse(argv)))
	.then(
		(code) => process.exit(code),
		(error: Error) => {
			console.error(error.message);
			process.exit(error instanceof HubError ? 2 : 1);
		},
	);
