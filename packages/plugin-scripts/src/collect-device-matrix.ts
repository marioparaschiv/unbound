import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { compareRuns, renderChanges, type MeasuredCheck } from './compare-device-matrix';
import { catalogPlugins, renderDeviceMatrix, type CatalogPlugin } from './device-matrix';
import { readMatrixConfig } from './matrix-config';
import { PLUGINS_DIR, REPO_ROOT } from './paths';
import { dropBaseline, dropReason, relaunchCommands } from './device-drops';
import { discordMemory, springBoardMemory } from './device-memory';
import { growthPerCycle, leakNote, liveHeapScript } from './leak-check';
import {
	SELF_TEST_MARKER,
	judgeSelfTest,
	selfTestCancellationScript,
	selfTestFinishScript,
	selfTestStartScript,
	type SelfTestCounts,
	type SelfTestResult,
} from './loader-self-test';

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

export const LAYOUT_FIXTURES = {
	original: 'Fixture original for the reply',
	reply: 'Fixture reply to the message above',
	forwarded: 'Fixture forwarded text',
};

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
	var make = function (fields) { return Object.assign(bot.createBotMessage({ channelId: ${JSON.stringify(channel)}, content: '' }), { flags: 0 }, fields); };
	var reference = function (message, type) { return { type: type, channel_id: ${JSON.stringify(channel)}, guild_id: ${JSON.stringify(guild)}, message_id: message.id }; };
	var original = make({ content: ${JSON.stringify(LAYOUT_FIXTURES.original)} });
	var me = metro.findStore('User').getCurrentUser();
	var image = 'https://cdn.discordapp.com/avatars/' + me.id + '/' + me.avatar + '.png?size=128';
	actions.receiveMessage(${JSON.stringify(channel)}, original);
	[
		make({ type: 19, content: ${JSON.stringify(LAYOUT_FIXTURES.reply)}, message_reference: reference(original, 0), referenced_message: original }),
		make({ attachments: [{ id: String(Date.now()), filename: 'fixture.png', url: image, proxy_url: image, width: 128, height: 128, content_type: 'image/png', size: 4096 }] }),
		make({ message_reference: reference(original, 1), message_snapshots: [{ message: { content: ${JSON.stringify(LAYOUT_FIXTURES.forwarded)}, timestamp: new Date().toISOString(), type: 0, embeds: [], attachments: [], flags: 0 } }] }),
	].forEach(function (message) { actions.receiveMessage(${JSON.stringify(channel)}, message); });
	var contents = ${JSON.stringify(FIXTURE_MESSAGES)}.filter(function (content) { return linked || content.indexOf('{message}') === -1; });
	for (var index = 0; index < contents.length; index++) {
		var content = contents[index].replace('{self}', self).replace('{guild}', ${JSON.stringify(guild)}).replace('{channel}', ${JSON.stringify(channel)}).replace('{message}', linked ? linked.id : '');
		actions.receiveMessage(${JSON.stringify(channel)}, bot.createBotMessage({ channelId: ${JSON.stringify(channel)}, content: content }));
	}
	await new Promise(function (resolve) { setTimeout(resolve, 1500); });
	return 'staged';
})()`;
}

const SELF_TEST_SWIPES = 4;

export function withoutSelfTest(errors: Map<string, string[]>): Map<string, string[]> {
	return new Map(
		[...errors]
			.map(
				([plugin, found]) =>
					[plugin, found.filter((error) => !error.includes(SELF_TEST_MARKER))] as const,
			)
			.filter(([, found]) => found.length > 0),
	);
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

export function pluginLogScript(): string {
	return `Promise.resolve(unbound.fs.read('Unbound/Logs/unbound.log')).then(function (text) {
	return JSON.stringify(String(text).split('\\n').filter(function (line) { return line.indexOf('off the main thread') !== -1 || line.indexOf(' E [') !== -1 || line.indexOf('Native plugin hook skipped in') !== -1; }));
}, function () { return '[]'; })`;
}

const HOOK_FAILURE = /^(\S+) E \[plugins\] Native plugin (?:hook|callback) failed in (.+?): (.*)$/;
const CONSOLE_ERROR = /^(\S+) E \[console\] '?\[([^\]:]+)(?::[^\]]*)?\]:? ?'?,? ?(.*)$/;
const ERROR_LENGTH = 160;

const REPEAT_SUFFIX = / \[repeated \d+ times\]$/;

function errorText(text: string): string {
	return text.replace(REPEAT_SUFFIX, '').replace(/\s+/g, ' ').trim().slice(0, ERROR_LENGTH);
}

export function parsePluginErrors(lines: string[], since: string): Map<string, string[]> {
	const errors = new Map<string, Set<string>>();

	for (const line of lines) {
		const match = HOOK_FAILURE.exec(line) ?? CONSOLE_ERROR.exec(line);

		if (!match || match[1]! < since) continue;

		const message = errorText(match[3]!);

		if (!message) continue;

		const plugin = errors.get(match[2]!) ?? new Set<string>();

		plugin.add(message);
		errors.set(match[2]!, plugin);
	}

	return new Map([...errors].map(([plugin, found]) => [plugin, [...found].sort()]));
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

const SKIPPED_HOOK =
	/^(\S+) \w \[plugins\] Native plugin hook skipped in (.+?): the JavaScript thread did not answer the (\S+) hook/;

export function parseSkippedHooks(lines: string[], since: string): Map<string, string[]> {
	const skipped = new Map<string, Set<string>>();

	for (const line of lines) {
		const match = SKIPPED_HOOK.exec(line);

		if (!match || match[1]! < since) continue;

		const plugin = skipped.get(match[2]!) ?? new Set<string>();

		plugin.add(match[3]!);
		skipped.set(match[2]!, plugin);
	}

	return new Map([...skipped].map(([plugin, found]) => [plugin, [...found].sort()]));
}

type LogFinding = { field: 'offMainCalls' | 'errors'; label: string; separator: string };

const LOG_FINDINGS: LogFinding[] = [
	{ field: 'offMainCalls', label: 'off-main view calls', separator: ', ' },
	{ field: 'errors', label: 'errors', separator: '; ' },
];

export function applyLogPolicy(
	checks: MeasuredCheck[],
	baseline: MeasuredCheck[] | undefined,
	strict: boolean,
): MeasuredCheck[] {
	const earlier = new Map(baseline?.map((check) => [check.id, check]));

	return checks.map((check) => {
		const failures = LOG_FINDINGS.flatMap(({ field, label, separator }) => {
			const found = check[field] ?? [];
			const previous = earlier.get(check.id);
			const known = new Set(previous?.[field] ?? []);
			const flagged = strict
				? found
				: found.filter((entry) => previous !== undefined && !known.has(entry));

			return flagged.length
				? [`${strict ? '' : 'new '}${label}: ${flagged.join(separator)}`]
				: [];
		});

		if (!failures.length) return check;

		return {
			...check,
			behavior: 'fail',
			note: [check.note, ...failures].filter(Boolean).join('; '),
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

const BRIDGE_ATTEMPTS = 40;
const BRIDGE_WAIT_MS = 3_000;
const BRIDGE_SETTLE_MS = 8_000;

async function waitForBridge(port: number): Promise<void> {
	for (let attempt = 0; attempt < BRIDGE_ATTEMPTS; attempt++) {
		const ready = await evaluateOnce(port, "'ready'").catch(() => undefined);

		if (ready === 'ready') {
			await Bun.sleep(BRIDGE_SETTLE_MS);

			return;
		}

		await Bun.sleep(BRIDGE_WAIT_MS);
	}

	throw new Error('Device disconnected: Discord did not come back after a relaunch.');
}

export const SCROLL_SWIPES = 12;
const SCROLL_SWIPE_MS = 120;
const IOS_POINTS = { width: 375, height: 667 };

export type ScreenSize = { width: number; height: number };

export function parseScreenSize(output: string): ScreenSize | undefined {
	const sizes = [...output.matchAll(/(\d+)x(\d+)/g)];
	const size = sizes.at(-1);

	return size ? { width: Number(size[1]), height: Number(size[2]) } : undefined;
}

export function swipeCommands(
	target: ScreenshotTarget,
	size: ScreenSize,
	swipes: number,
): string[][] {
	const screen = target.kind === 'ios' ? IOS_POINTS : size;
	const x = Math.round(screen.width / 2);
	const top = Math.round(screen.height * 0.3);
	const bottom = Math.round(screen.height * 0.75);

	return Array.from({ length: swipes }, (_, index) => {
		const [from, to] = index < swipes / 2 ? [top, bottom] : [bottom, top];

		if (target.kind === 'ios') {
			const points = JSON.stringify([
				{ x, y: from },
				{ x, y: to },
			]);

			return [
				'jb-p1lot',
				'ui_action',
				'--device',
				target.udid,
				'--action',
				'swipe',
				'--points',
				points,
			];
		}

		const serial = target.serial ? ['-s', target.serial] : [];

		return [
			'adb',
			...serial,
			'shell',
			'input',
			'swipe',
			`${x}`,
			`${from}`,
			`${x}`,
			`${to}`,
			`${SCROLL_SWIPE_MS}`,
		];
	});
}

async function screenSize(target: ScreenshotTarget): Promise<ScreenSize> {
	if (target.kind === 'ios') return IOS_POINTS;

	const serial = target.serial ? ['-s', target.serial] : [];
	const { stdout } = await run(['adb', ...serial, 'shell', 'wm', 'size']);

	return parseScreenSize(stdout) ?? { width: 1080, height: 2400 };
}

export const SCROLL_FILLER = 30;
const TOAST_SETTLE_MS = 5_500;

export function scrollFillerScript(channel: string): string {
	return `(async function () {
	var metro = unbound.metro;
	var actions = metro.findByProps('sendMessage', 'receiveMessage');
	var bot = metro.findByProps('createBotMessage');
	var self = metro.findStore('User').getCurrentUser().id;
	for (var index = 0; index < ${SCROLL_FILLER}; index++) {
		var content = index % 3 === 0 ? 'Scroll filler ' + index + ' for <@' + self + '>' : 'Scroll filler ' + index;
		actions.receiveMessage(${JSON.stringify(channel)}, bot.createBotMessage({ channelId: ${JSON.stringify(channel)}, content: content }));
	}
	await new Promise(function (resolve) { setTimeout(resolve, 1500); });
	return 'staged';
})()`;
}

export type ScrollOutcome = { swipes: number; moved?: boolean };

type ScrollReport = ScrollOutcome & { toasts: string[]; emptyToasts: string[] };

async function sameScreen(before: string, after: string): Promise<boolean | undefined> {
	if (!existsSync(before) || !existsSync(after)) return undefined;

	const [a, b] = await Promise.all([Bun.file(before).bytes(), Bun.file(after).bytes()]);

	return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

async function swipeAll(commands: string[][]): Promise<number> {
	let performed = 0;

	for (const command of commands) {
		if ((await run(command)).ok) performed += 1;
	}

	return performed;
}

async function scrollStress(target: ScreenshotTarget, out: string): Promise<ScrollOutcome> {
	const commands = swipeCommands(target, await screenSize(target), SCROLL_SWIPES);
	const half = commands.length / 2;
	const before = join(out, 'scroll-before.png');
	const after = join(out, 'scroll-after.png');
	const capturedBefore = await screenshot(target, before);
	const older = await swipeAll(commands.slice(0, half));
	const capturedAfter = await screenshot(target, after);
	const newer = await swipeAll(commands.slice(half));
	const same = capturedBefore && capturedAfter ? await sameScreen(before, after) : undefined;

	return { swipes: older + newer, moved: same === undefined ? undefined : !same };
}

export function toastLogScript(): string {
	return `Promise.resolve(unbound.fs.read('Unbound/Logs/unbound.log')).then(function (text) {
	return JSON.stringify(String(text).split('\\n').filter(function (line) { return line.indexOf('[Toasts]') !== -1; }));
}, function () { return '[]'; })`;
}

const TOAST_LINE =
	/^(\S+) \w \[console\] .*\[Toasts\]'?,? ?'?(Showing a toast:|Ignored a (?:Discord )?toast[^']*)'?,? ?'?([^']*)/;

export function parseToastLines(lines: string[], since: string): string[] {
	return lines.flatMap((line) => {
		const match = TOAST_LINE.exec(line);

		if (!match || match[1]! < since) return [];

		if (match[2]!.startsWith('Showing')) return [match[3]!.trim() || 'untitled'];

		const caller = toastCaller(match[3]!);

		return [caller ? `empty toast from ${caller}` : 'empty toast'];
	});
}

const STACK_FRAME = /\bat ([\w$.]+) \(/g;
const TOAST_FRAMES = new Set(['Error', 'showToast', 'addToast', 'open', 'instead']);

export function toastCaller(stack: string): string | undefined {
	return [...stack.matchAll(STACK_FRAME)]
		.map((frame) => frame[1]!)
		.find((name) => !TOAST_FRAMES.has(name) && name !== 'anonymous' && name !== 'eval');
}

export function isEmptyToast(toast: string): boolean {
	return toast.startsWith('empty toast');
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
			lenient: { type: 'boolean' },
			'leak-cycles': { type: 'string' },
		},
	});

	if (!values.out) {
		throw new Error(
			'Usage: bun packages/plugin-scripts/src/collect-device-matrix.ts --out <dir> [--port 9090] [--serial <adb serial> | --udid <iPhone UDID>] [--only <id,id>] [--device <name>] [--baseline <results.json>] [--channel <guild id>/<channel id>] [--lenient]',
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

	const dropsBefore = await dropBaseline(target, run);
	const memoryBefore = await discordMemory(target, run);
	let relaunched = false;

	async function measure(plugin: CatalogPlugin): Promise<MeasuredCheck> {
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

		return checkFromCycle(result, captured ? `${plugin.id}.png` : undefined);
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

		const counts = JSON.parse(await evaluate(port, selfTestFinishScript())) as SelfTestCounts;
		const ended = JSON.parse(
			await evaluate(port, selfTestCancellationScript()),
		) as SelfTestCounts;

		if (ended.error) return { ok: false, detail: ended.error };

		if (ended.host === counts.host) counts.cancellations = ended.cancellations;

		await Bun.sleep(1_000);

		const lines = JSON.parse(await evaluate(port, pluginLogScript())) as string[];

		return judgeSelfTest(counts, parsePluginErrors(lines, started));
	}

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

	for (const plugin of catalog) {
		let check: MeasuredCheck | undefined;

		for (let attempt = 0; !check; attempt++) {
			try {
				const before = await discordMemory(target, run);

				check = await measure(plugin);

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
		const result = JSON.parse(await evaluate(port, cycleScript(id))) as CycleResult;

		if (result.installed && !result.wasStarted) await evaluate(port, restoreScript(id));
	}

	async function leakCheck(check: MeasuredCheck): Promise<void> {
		await cycleQuietly(check.id);

		const before = Number(await evaluate(port, liveHeapScript()));

		for (let cycle = 0; cycle < leakCycles; cycle++) await cycleQuietly(check.id);

		const perCycle = growthPerCycle(
			before,
			Number(await evaluate(port, liveHeapScript())),
			leakCycles,
		);

		if (perCycle === undefined) return;

		check.leakPerCycleMB = perCycle;

		const note = leakNote(perCycle, leakCycles);

		if (note) {
			check.behavior = 'fail';
			check.note = [check.note, note].filter(Boolean).join('; ');
		}

		console.error(`leak check ${check.id}: ${perCycle} MB per cycle`);
	}

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

	async function afterRecovery<T>(label: string, step: () => Promise<T>): Promise<T> {
		try {
			return await step();
		} catch (error) {
			if (!isDisconnect(error)) throw error;

			await recover(label);

			return step();
		}
	}

	async function scrollPhase(): Promise<ScrollReport> {
		if (fixtures) await evaluate(port, scrollFillerScript(fixtures.channel));

		await Bun.sleep(TOAST_SETTLE_MS);

		const scrollSince = new Date().toISOString();
		const { swipes, moved } = await scrollStress(target, out);

		await Bun.sleep(2_000);

		const toastLines = JSON.parse(await evaluate(port, toastLogScript())) as string[];

		return {
			swipes,
			moved,
			toasts: parseToastLines(toastLines, scrollSince),
			emptyToasts: parseToastLines(toastLines, since).filter(isEmptyToast),
		};
	}

	const scroll = await afterRecovery('the scroll check', scrollPhase);

	writeFileSync(join(out, 'scroll.json'), `${JSON.stringify(scroll, null, '\t')}\n`);

	const memory = {
		beforeMB: memoryBefore,
		afterMB: await discordMemory(target, run),
		relaunched,
		springBoard: await springBoardMemory(target, run),
	};

	writeFileSync(join(out, 'memory.json'), `${JSON.stringify(memory, null, '\t')}\n`);
	console.error(
		`scrolled ${scroll.swipes} times${scroll.moved === false ? ' without moving the list' : ''}; ${scroll.toasts.length} toasts appeared`,
	);

	const logLines = JSON.parse(
		await afterRecovery('the log read', () => evaluate(port, pluginLogScript())),
	) as string[];
	const warnings = parseOffMainWarnings(logLines, since);
	const errors = withoutSelfTest(parsePluginErrors(logLines, since));
	const skippedHooks = parseSkippedHooks(logLines, since);

	if (!developerMode) await evaluate(port, developerModeScript(false));

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
