import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type ScreenshotTarget = { kind: 'android'; serial?: string } | { kind: 'ios'; udid: string };

export type ScreenSize = { width: number; height: number };

export type ScrollOutcome = { swipes: number; moved?: boolean };

export type CommandResult = { ok: boolean; stdout: string; stderr: string };

/** Runs a host command, such as `adb` or `jb-p1lot`, against the device. */
export type CommandRunner = (command: string[]) => Promise<CommandResult>;

/** What scrolling needs: the commands it runs and the screenshots it compares. */
export type ScrollHost = {
	target: ScreenshotTarget;
	run: CommandRunner;
	screenshot(file: string): Promise<boolean>;
};

type TargetFlags = { ios?: boolean; udid?: string; serial?: string };

const SCROLL_SWIPE_MS = 120;
const IOS_POINTS = { width: 375, height: 667 };

export const SCROLL_SWIPES = 12;

export async function run(command: string[]): Promise<CommandResult> {
	const process = Bun.spawn(command, { stdout: 'pipe', stderr: 'pipe' });
	const [stdout, stderr, code] = await Promise.all([
		new Response(process.stdout).text(),
		new Response(process.stderr).text(),
		process.exited,
	]);

	return { ok: code === 0, stdout, stderr };
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

export async function screenSize(
	target: ScreenshotTarget,
	run: CommandRunner,
): Promise<ScreenSize> {
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

export async function swipeAll(run: CommandRunner, commands: string[][]): Promise<number> {
	let performed = 0;

	for (const command of commands) {
		if ((await run(command)).ok) performed += 1;
	}

	return performed;
}

export const NEWEST_SWIPES = 4;

export async function scrollToNewest({ target, run }: ScrollHost): Promise<number> {
	const commands = swipeCommands(target, await screenSize(target, run), NEWEST_SWIPES * 2);

	return swipeAll(run, commands.slice(NEWEST_SWIPES));
}

export async function scrollStress(host: ScrollHost, out: string): Promise<ScrollOutcome> {
	const { target, run } = host;
	const commands = swipeCommands(target, await screenSize(target, run), SCROLL_SWIPES);
	const half = commands.length / 2;
	const before = join(out, 'scroll-before.png');
	const after = join(out, 'scroll-after.png');
	const capturedBefore = await host.screenshot(before);
	const older = await swipeAll(run, commands.slice(0, half));
	const capturedAfter = await host.screenshot(after);
	const newer = await swipeAll(run, commands.slice(half));
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
