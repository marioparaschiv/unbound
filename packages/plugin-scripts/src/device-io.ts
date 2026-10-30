import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { z } from '@unbound-app/contracts/zod';
import { join } from 'node:path';

import { REPO_ROOT } from './paths';

export type ScreenshotTarget = { kind: 'android'; serial?: string } | { kind: 'ios'; udid: string };

export type ScreenSize = { width: number; height: number };

export type ScrollOutcome = { swipes: number; moved?: boolean };

type CommandResult = { ok: boolean; stdout: string; stderr: string };

type TargetFlags = { ios?: boolean; udid?: string; serial?: string };

const CLI = join(REPO_ROOT, 'packages/cli/src/index.ts');
const EVAL_TIMEOUT_MS = 60_000;
const RECONNECT_PATTERN = /disconnected|No device is connected/i;
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_WAIT_MS = 5_000;
const BRIDGE_ATTEMPTS = 40;
const BRIDGE_WAIT_MS = 3_000;
const BRIDGE_SETTLE_MS = 8_000;
const SCROLL_SWIPE_MS = 120;
const IOS_POINTS = { width: 375, height: 667 };

export const SCROLL_SWIPES = 12;

// `unbound eval --json` prints the eval result; only `ok`, `value` and `error` are read.
const evalReplySchema = z.object({
	ok: z.optional(z.boolean()),
	value: z.optional(z.unknown()),
	error: z.optional(z.unknown()),
});

export async function run(command: string[]): Promise<CommandResult> {
	const process = Bun.spawn(command, { stdout: 'pipe', stderr: 'pipe' });
	const [stdout, stderr, code] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	]);

	return { ok: code === 0, stdout, stderr };
}

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
	const parsed = evalReplySchema.safeParse(JSON.parse(line || '{}'));
	const reply = parsed.success ? parsed.data : {};

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

export function evaluate(port: number, code: string): Promise<string> {
	return withReconnects(() => evaluateOnce(port, code));
}

/**
 * @description Evaluates a script whose result is JSON and parses that result with a schema.
 * @template T The parsed result.
 * @param port The debugger bridge port.
 * @param code A script that returns a JSON string.
 * @param schema The shape the script's JSON must have.
 * @returns The parsed result.
 */
export async function evaluateJson<T>(
	port: number,
	code: string,
	schema: z.ZodMiniType<T>,
): Promise<T> {
	return schema.parse(JSON.parse(await evaluate(port, code)));
}

export async function waitForBridge(port: number): Promise<void> {
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

export async function screenSize(target: ScreenshotTarget): Promise<ScreenSize> {
	if (target.kind === 'ios') return IOS_POINTS;

	const serial = target.serial ? ['-s', target.serial] : [];
	const { stdout } = await run(['adb', ...serial, 'shell', 'wm', 'size']);

	return parseScreenSize(stdout) ?? { width: 1080, height: 2400 };
}

async function sameScreen(before: string, after: string): Promise<boolean | undefined> {
	if (!existsSync(before) || !existsSync(after)) return undefined;

	const [a, b] = await Promise.all([Bun.file(before).bytes(), Bun.file(after).bytes()]);

	return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

export async function swipeAll(commands: string[][]): Promise<number> {
	let performed = 0;

	for (const command of commands) {
		if ((await run(command)).ok) performed += 1;
	}

	return performed;
}

export async function scrollStress(target: ScreenshotTarget, out: string): Promise<ScrollOutcome> {
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

export async function screenshot(target: ScreenshotTarget, file: string): Promise<boolean> {
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

export function screenshotTarget(values: TargetFlags): ScreenshotTarget {
	if (values.ios || values.udid) {
		if (!values.udid) throw new Error('Pass --udid with --ios.');

		return { kind: 'ios', udid: values.udid };
	}

	return { kind: 'android', serial: values.serial };
}
