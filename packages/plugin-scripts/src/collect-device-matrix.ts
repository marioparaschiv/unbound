import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { compareRuns, renderChanges, type MeasuredCheck } from './compare-device-matrix';
import { catalogPlugins, renderDeviceMatrix } from './device-matrix';
import { PLUGINS_DIR, REPO_ROOT } from './paths';

export type CycleResult = {
	id: string;
	installed: boolean;
	wasStarted: boolean;
	error: string;
	restarted: boolean;
	updateError: string;
	updated: boolean;
	hooksBefore: number;
	hooksStopped: number;
	hooksAfter: number;
	hooksUpdated: number;
	stopMs?: number;
	startMs?: number;
	selfTest?: { ok: boolean; detail: string };
};

export type ScreenshotTarget = { kind: 'android'; serial?: string } | { kind: 'ios'; udid: string };

const CLI = join(REPO_ROOT, 'packages/cli/src/index.ts');
const EVAL_TIMEOUT_MS = 60_000;

export function cycleScript(id: string): string {
	return `(async function () {
	var manager = unbound.plugins;
	var read = unbound.native && unbound.native.getNativeResources;
	var hooks = function () { var counts = read ? read() : null; return counts ? counts.hooks : 0; };
	var settle = function () { return new Promise(function (resolve) { setTimeout(resolve, 300); }); };
	var message = function (failure) { return String(failure && failure.message ? failure.message : failure); };
	var id = ${JSON.stringify(id)};
	var entity = manager.getEntity(id);
	var result = { id: id, installed: Boolean(entity), wasStarted: Boolean(entity && entity.started), error: '', restarted: false, updateError: '', updated: false, hooksBefore: 0, hooksStopped: 0, hooksAfter: 0, hooksUpdated: 0 };
	if (!entity) return JSON.stringify(result);
	if (!result.wasStarted) {
		try { await manager.start(id); } catch (failure) { result.error = message(failure); }
		await settle();
	}
	var before = manager.errors.get(id);
	result.hooksBefore = hooks();
	var stopping = Date.now();
	try { await manager.stop(id); } catch (failure) { result.error = result.error || message(failure); }
	result.stopMs = Date.now() - stopping;
	result.hooksStopped = hooks();
	var starting = Date.now();
	try { await manager.start(id); } catch (failure) { result.error = result.error || message(failure); }
	result.startMs = Date.now() - starting;
	await settle();
	var after = manager.errors.get(id);
	if (!result.error && after && after !== before) result.error = message(after);
	entity = manager.getEntity(id);
	result.restarted = Boolean(entity && entity.started);
	result.hooksAfter = hooks();
	if (result.restarted) {
		try {
			var update = await manager.reload(id, entity.bundle, entity.data);
			if (!update.ok) result.updateError = message(update.error);
		} catch (failure) { result.updateError = message(failure); }
		await settle();
	}
	var updated = manager.getEntity(id);
	result.updated = Boolean(updated && updated.started);
	result.hooksUpdated = hooks();
	var instance = updated && updated.instance;
	if (result.updated && instance && typeof instance.selfTest === 'function') {
		try {
			var report = await instance.selfTest();
			if (report) result.selfTest = { ok: Boolean(report.ok), detail: String(report.detail) };
		} catch (failure) { result.selfTest = { ok: false, detail: message(failure) }; }
	}
	return JSON.stringify(result);
})()`;
}

export function restoreScript(id: string): string {
	return `Promise.resolve(unbound.plugins.stop(${JSON.stringify(id)})).then(function () { return "stopped"; })`;
}

function lifecycleFailure(result: CycleResult): string | undefined {
	if (result.error) return result.error;
	if (!result.restarted) return 'did not start again after stopping';
	if (result.updateError) return `reload failed: ${result.updateError}`;
	if (!result.updated) return 'stopped after a reload';
	if (result.hooksStopped > result.hooksBefore) return 'stopping added native hooks';
	if (result.hooksAfter > result.hooksBefore)
		return `restarting leaked ${result.hooksAfter - result.hooksBefore} native hooks`;
	if (result.hooksUpdated > result.hooksAfter)
		return `reloading leaked ${result.hooksUpdated - result.hooksAfter} native hooks`;

	return undefined;
}

export function checkFromCycle(result: CycleResult, screenshot?: string): MeasuredCheck {
	if (!result.installed) {
		return {
			id: result.id,
			behavior: 'fail',
			lifecycle: 'fail',
			evidence: ['cycle: not installed'],
			note: 'Not installed on the device.',
		};
	}

	const evidence = [
		`cycle: hooks ${result.hooksBefore}→${result.hooksStopped}→${result.hooksAfter}→${result.hooksUpdated}`,
		...(result.selfTest ? [`self-test: ${result.selfTest.detail}`] : []),
		...(screenshot ? [`screenshot: ${screenshot}`] : []),
	];
	const failure = lifecycleFailure(result);
	const selfTestFailure =
		result.selfTest && !result.selfTest.ok
			? `self-test failed: ${result.selfTest.detail}`
			: undefined;
	const behavior = result.error || !result.updated || selfTestFailure ? 'fail' : 'pass';
	const note = [failure, selfTestFailure].filter(Boolean).join('; ');

	return {
		id: result.id,
		behavior,
		lifecycle: failure ? 'fail' : 'pass',
		evidence,
		...(note ? { note } : {}),
		metrics: {
			stopMs: result.stopMs ?? 0,
			startMs: result.startMs ?? 0,
			leakedHooks:
				Math.max(0, result.hooksAfter - result.hooksBefore) +
				Math.max(0, result.hooksUpdated - result.hooksAfter),
		},
	};
}

async function run(command: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
	const process = Bun.spawn(command, { stdout: 'pipe', stderr: 'pipe' });
	const [stdout, stderr, code] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	]);

	return { ok: code === 0, stdout, stderr };
}

const RECONNECT_PATTERN = /disconnected|No device is connected/i;
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_WAIT_MS = 5_000;

export function isDisconnect(error: unknown): boolean {
	return error instanceof Error && RECONNECT_PATTERN.test(error.message);
}

export async function withReconnects<T>(
	attempt: () => Promise<T>,
	wait = (ms: number) => Bun.sleep(ms),
	attempts = RECONNECT_ATTEMPTS,
): Promise<T> {
	for (let retry = 0; ; retry++) {
		try {
			return await attempt();
		} catch (error) {
			if (retry >= attempts || !isDisconnect(error)) throw error;

			console.error(`Device disconnected, retrying in ${RECONNECT_WAIT_MS / 1000}s.`);
			await wait(RECONNECT_WAIT_MS);
		}
	}
}

async function evaluateOnce(port: number, code: string): Promise<string> {
	const { stdout, stderr } = await run([
		'bun',
		CLI,
		'eval',
		'--port',
		String(port),
		'--timeout',
		String(EVAL_TIMEOUT_MS),
		'--json',
		code,
	]);
	const line = stdout.trim().split('\n').at(-1) ?? '';
	const reply = JSON.parse(line || '{}') as { ok?: boolean; value?: string; error?: unknown };

	if (!reply.ok || typeof reply.value !== 'string') {
		const reason = reply.error ?? stderr.trim();

		throw new Error(
			reason
				? `Evaluation failed: ${JSON.stringify(reason)}`
				: 'Device disconnected without a reply.',
		);
	}

	return reply.value;
}

function evaluate(port: number, code: string): Promise<string> {
	return withReconnects(() => evaluateOnce(port, code));
}

async function screenshot(target: ScreenshotTarget, file: string): Promise<boolean> {
	if (target.kind === 'android') {
		const serial = target.serial ? ['-s', target.serial] : [];
		const capture = Bun.spawn(['adb', ...serial, 'exec-out', 'screencap', '-p'], {
			stdout: 'pipe',
		});
		const image = await new Response(capture.stdout).arrayBuffer();

		if ((await capture.exited) !== 0 || !image.byteLength) return false;

		writeFileSync(file, new Uint8Array(image));

		return true;
	}

	const { ok, stdout } = await run(['jb-p1lot', 'screen_capture', '--device', target.udid]);
	const captured = stdout.trim().split('\n')[0];

	if (!ok || !captured) return false;

	copyFileSync(captured, file);

	return true;
}

function screenshotTarget(values: { ios?: boolean; udid?: string; serial?: string }) {
	if (values.ios || values.udid) {
		if (!values.udid) throw new Error('Pass --udid with --ios.');

		return { kind: 'ios', udid: values.udid } as const;
	}

	return { kind: 'android', serial: values.serial } as const;
}

export function mergeChecks(previous: MeasuredCheck[], current: MeasuredCheck[]): MeasuredCheck[] {
	const updated = new Map(current.map((check) => [check.id, check]));
	const merged = previous.map((check) => updated.get(check.id) ?? check);
	const known = new Set(previous.map((check) => check.id));

	return [...merged, ...current.filter((check) => !known.has(check.id))];
}

function readBaseline(path: string): MeasuredCheck[] | undefined {
	if (!existsSync(path)) return undefined;

	try {
		const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;

		return Array.isArray(parsed) ? (parsed as MeasuredCheck[]) : undefined;
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
			device: { type: 'string' },
			baseline: { type: 'string' },
		},
	});

	if (!values.out) {
		throw new Error(
			'Usage: bun packages/plugin-scripts/src/collect-device-matrix.ts --out <dir> [--port 9090] [--serial <adb serial> | --udid <iPhone UDID>] [--only <id,id>] [--device <name>] [--baseline <results.json>]',
		);
	}

	const port = Number(values.port);
	const out = resolve(values.out);
	const target = screenshotTarget(values);
	const only = values.only ? new Set(values.only.split(',')) : undefined;
	const catalog = catalogPlugins(PLUGINS_DIR).filter((plugin) => !only || only.has(plugin.id));
	const checks: MeasuredCheck[] = [];

	mkdirSync(out, { recursive: true });

	for (const plugin of catalog) {
		const result = JSON.parse(await evaluate(port, cycleScript(plugin.id))) as CycleResult;
		const file = join(out, `${plugin.id}.png`);
		const captured = result.installed && (await screenshot(target, file));

		if (result.installed && !result.wasStarted) await evaluate(port, restoreScript(plugin.id));

		const check = checkFromCycle(result, captured ? `${plugin.id}.png` : undefined);

		checks.push(check);
		console.error(
			`${check.lifecycle === 'pass' && check.behavior === 'pass' ? 'pass' : 'FAIL'} ${plugin.id}`,
		);
	}

	const baseline = readBaseline(
		values.baseline ? resolve(values.baseline) : join(out, 'results.json'),
	);

	const compared = baseline?.filter((check) => !only || only.has(check.id));
	const saved = only && baseline ? mergeChecks(baseline, checks) : checks;

	writeFileSync(join(out, 'results.json'), `${JSON.stringify(saved, null, '\t')}\n`);

	if (compared) {
		const changes = compareRuns(compared, checks);

		writeFileSync(join(out, 'changes.md'), `${renderChanges(changes)}\n`);

		for (const change of changes) console.error(`changed: ${change}`);
	}
	writeFileSync(
		join(out, 'matrix.md'),
		`${renderDeviceMatrix(catalog, checks, values.device ?? (target.kind === 'ios' ? 'iOS' : 'Android'))}\n`,
	);
	console.log(join(out, 'matrix.md'));
}

if (import.meta.main) await main();
