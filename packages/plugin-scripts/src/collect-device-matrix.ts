import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { compareRuns, renderChanges, type MeasuredCheck } from './compare-device-matrix';
import { catalogPlugins, renderDeviceMatrix } from './device-matrix';
import { readMatrixConfig } from './matrix-config';
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
	await new Promise(function (resolve) { setTimeout(resolve, 1000); });
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

export const FIXTURE_MESSAGES = [
	'```ts\nconst answer: number = 42;\nfunction double(value: number) {\n\treturn value * 2;\n}\n```',
	'Fixture mention <@{self}> with a link https://discord.com/channels/{guild}/{channel}',
	'Plain fixture message for bubbles and avatars.',
	'Fixture message link https://discord.com/channels/{guild}/{channel}/{message}',
];

export function parseChannel(value: string): { guild: string; channel: string } {
	const match = /^(\d+)\/(\d+)$/.exec(value.trim());

	if (!match) throw new Error('Pass --channel as <guild id>/<channel id>.');

	return { guild: match[1]!, channel: match[2]! };
}

export function fixtureScript(guild: string, channel: string): string {
	return `(async function () {
	var metro = unbound.metro;
	metro.findByProps('transitionToGuild').transitionToGuild(${JSON.stringify(guild)}, ${JSON.stringify(channel)});
	await new Promise(function (resolve) { setTimeout(resolve, 1500); });
	var actions = metro.findByProps('sendMessage', 'receiveMessage');
	var bot = metro.findByProps('createBotMessage');
	var self = metro.findStore('User').getCurrentUser().id;
	var loaded = metro.findStore('Message').getMessages(${JSON.stringify(channel)});
	var linked = (loaded && loaded.toArray ? loaded.toArray() : []).filter(function (message) { return message.author && !message.author.bot && /^\\d+$/.test(message.id); }).pop();
	var contents = ${JSON.stringify(FIXTURE_MESSAGES)}.filter(function (content) { return linked || content.indexOf('{message}') === -1; });
	for (var index = 0; index < contents.length; index++) {
		var content = contents[index].replace('{self}', self).replace('{guild}', ${JSON.stringify(guild)}).replace('{channel}', ${JSON.stringify(channel)}).replace('{message}', linked ? linked.id : '');
		actions.receiveMessage(${JSON.stringify(channel)}, bot.createBotMessage({ channelId: ${JSON.stringify(channel)}, content: content }));
	}
	await new Promise(function (resolve) { setTimeout(resolve, 1500); });
	return 'staged';
})()`;
}

const OFF_MAIN_WARNING = /^(\S+) W \[plugins\] (.+?) called (.+?) off the main thread\./;

export function developerModeScript(enabled: boolean): string {
	return `(function () {
	var store = unbound.storage.getStore('unbound');
	var previous = store.get('developer-mode', false);
	store.set('developer-mode', ${enabled});
	return String(previous);
})()`;
}

export function offMainLogScript(): string {
	return `Promise.resolve(unbound.fs.read('Unbound/Logs/unbound.log')).then(function (text) {
	return JSON.stringify(String(text).split('\\n').filter(function (line) { return line.indexOf('off the main thread') !== -1; }));
}, function () { return '[]'; })`;
}

export function parseOffMainWarnings(lines: string[], since: string): Map<string, string[]> {
	const calls = new Map<string, Set<string>>();

	for (const line of lines) {
		const match = OFF_MAIN_WARNING.exec(line);

		if (!match || match[1]! < since) continue;

		const plugin = calls.get(match[2]!) ?? new Set<string>();

		plugin.add(match[3]!);
		calls.set(match[2]!, plugin);
	}

	return new Map([...calls].map(([plugin, found]) => [plugin, [...found].sort()]));
}

export function applyOffMainPolicy(
	checks: MeasuredCheck[],
	baseline: MeasuredCheck[] | undefined,
	strict: boolean,
): MeasuredCheck[] {
	const known = new Map(baseline?.map((check) => [check.id, new Set(check.offMainCalls ?? [])]));

	return checks.map((check) => {
		const calls = check.offMainCalls ?? [];
		const flagged = strict
			? calls
			: calls.filter((call) => known.has(check.id) && !known.get(check.id)!.has(call));

		if (!flagged.length) return check;

		const failure = `${strict ? 'off-main' : 'new off-main'} view calls: ${flagged.join(', ')}`;

		return {
			...check,
			behavior: 'fail',
			note: [check.note, failure].filter(Boolean).join('; '),
		};
	});
}

export function fixturesPresentScript(channel: string): string {
	return `(function () {
	var metro = unbound.metro;
	var selected = metro.findStore('SelectedChannel').getChannelId();
	var loaded = metro.findStore('Message').getMessages(${JSON.stringify(channel)});
	var messages = loaded && loaded.toArray ? loaded.toArray() : [];
	var staged = messages.some(function (message) { return message.content === ${JSON.stringify(FIXTURE_MESSAGES[2])}; });
	return selected === ${JSON.stringify(channel)} && staged ? 'present' : 'missing';
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
			channel: { type: 'string' },
			device: { type: 'string' },
			baseline: { type: 'string' },
			strict: { type: 'boolean' },
		},
	});

	if (!values.out) {
		throw new Error(
			'Usage: bun packages/plugin-scripts/src/collect-device-matrix.ts --out <dir> [--port 9090] [--serial <adb serial> | --udid <iPhone UDID>] [--only <id,id>] [--device <name>] [--baseline <results.json>] [--channel <guild id>/<channel id>] [--strict]',
		);
	}

	const port = Number(values.port);
	const out = resolve(values.out);
	const target = screenshotTarget(values);
	const only = values.only ? new Set(values.only.split(',')) : undefined;
	const catalog = catalogPlugins(PLUGINS_DIR).filter((plugin) => !only || only.has(plugin.id));
	const checks: MeasuredCheck[] = [];

	mkdirSync(out, { recursive: true });

	const fixtureChannel = values.channel ?? readMatrixConfig()?.channel;
	const fixtures = fixtureChannel ? parseChannel(fixtureChannel) : undefined;

	if (fixtures) await evaluate(port, fixtureScript(fixtures.guild, fixtures.channel));

	const since = new Date(Date.now() - 2_000).toISOString();
	const developerMode = (await evaluate(port, developerModeScript(false))) === 'true';

	await new Promise((done) => setTimeout(done, 1_500));
	await evaluate(port, developerModeScript(true));
	await new Promise((done) => setTimeout(done, 1_500));

	for (const plugin of catalog) {
		if (
			fixtures &&
			(await evaluate(port, fixturesPresentScript(fixtures.channel))) !== 'present'
		) {
			console.error(`fixtures were gone before ${plugin.id}; staging them again`);
			await evaluate(port, fixtureScript(fixtures.guild, fixtures.channel));
		}

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

	const warnings = parseOffMainWarnings(
		JSON.parse(await evaluate(port, offMainLogScript())) as string[],
		since,
	);

	if (!developerMode) await evaluate(port, developerModeScript(false));

	for (const check of checks) {
		const name = catalog.find((plugin) => plugin.id === check.id)?.name;
		const calls = name ? warnings.get(name) : undefined;

		if (calls?.length) check.offMainCalls = calls;
	}

	const baseline = readBaseline(
		values.baseline ? resolve(values.baseline) : join(out, 'results.json'),
	);

	const compared = baseline?.filter((check) => !only || only.has(check.id));

	checks.splice(
		0,
		checks.length,
		...applyOffMainPolicy(checks, compared, Boolean(values.strict)),
	);

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
