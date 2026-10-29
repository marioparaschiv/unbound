export type DropTarget = { kind: 'android'; serial?: string } | { kind: 'ios'; udid: string };

export type DropBaseline = { crashFiles: Set<string>; lastExit?: string };

export type ExitRecord = { timestamp: string; reason: string };

export type CommandRunner = (command: string[]) => Promise<{ ok: boolean; stdout: string }>;

const CRASH_DIRECTORY = '/var/mobile/Library/Logs/CrashReporter';
const IOS_BUNDLE = 'com.hammerandchisel.discord';
const ANDROID_PACKAGE = 'com.discord';
const PAGE_BYTES = 16_384;

type JetsamProcess = { name?: string; reason?: string; rpages?: number };

/**
 * @description Names every process a jetsam report killed, with the reason and its memory.
 * @param report The `.ips` report: a JSON header line followed by the JSON body.
 * @returns One `name (reason, MB)` entry per killed process.
 */
export function parseJetsamKills(report: string): string[] {
	const body = report.slice(report.indexOf('\n') + 1);
	let processes: JetsamProcess[] = [];

	try {
		processes = (JSON.parse(body) as { processes?: JetsamProcess[] }).processes ?? [];
	} catch {
		return [];
	}

	return processes
		.filter((process) => process.reason)
		.map((process) => {
			const megabytes = Math.round(((process.rpages ?? 0) * PAGE_BYTES) / 1_048_576);

			return `${process.name ?? 'unknown'} (${process.reason}, ${megabytes} MB)`;
		});
}

/**
 * @description Reads the newest exit record from `dumpsys activity exit-info`.
 * @param output The command output.
 * @returns The record's timestamp and reason, or `undefined` when there is none.
 */
export function parseLatestExit(output: string): ExitRecord | undefined {
	const timestamp = /timestamp=(\S+ \S+)/.exec(output)?.[1];
	const reason = /reason=\d+ \(([^)]+)\)/.exec(output)?.[1];

	return timestamp && reason ? { timestamp, reason } : undefined;
}

function adb(target: DropTarget, ...args: string[]): string[] {
	const serial = target.kind === 'android' && target.serial ? ['-s', target.serial] : [];

	return ['adb', ...serial, ...args];
}

function iosShell(target: Extract<DropTarget, { kind: 'ios' }>, command: string): string[] {
	return ['jb-p1lot', 'shell_exec', '--device', target.udid, '--command', command];
}

function shellOutput(stdout: string): string {
	try {
		return (JSON.parse(stdout) as { output?: string }).output ?? '';
	} catch {
		return stdout;
	}
}

async function crashFiles(target: DropTarget, run: CommandRunner): Promise<Set<string>> {
	if (target.kind !== 'ios') return new Set();

	const { stdout } = await run(iosShell(target, `ls ${CRASH_DIRECTORY}`));

	return new Set(shellOutput(stdout).split('\n').filter(Boolean));
}

async function latestExit(target: DropTarget, run: CommandRunner): Promise<ExitRecord | undefined> {
	if (target.kind !== 'android') return undefined;

	const { stdout } = await run(
		adb(target, 'shell', 'dumpsys', 'activity', 'exit-info', ANDROID_PACKAGE),
	);

	return parseLatestExit(stdout);
}

/**
 * @description Records the crash reports and app exits present before a run, so a later drop can be told apart.
 * @param target The device.
 * @param run Runs a host command.
 * @returns The baseline to pass to {@link dropReason}.
 */
export async function dropBaseline(target: DropTarget, run: CommandRunner): Promise<DropBaseline> {
	return {
		crashFiles: await crashFiles(target, run),
		lastExit: (await latestExit(target, run))?.timestamp,
	};
}

/**
 * @description Explains why a device stopped answering: a jetsam kill, a Discord crash or an app exit since the baseline.
 * @param target The device.
 * @param baseline What was there before the run.
 * @param run Runs a host command.
 * @returns A short reason, or `undefined` when nothing new explains the drop.
 */
export async function dropReason(
	target: DropTarget,
	baseline: DropBaseline,
	run: CommandRunner,
): Promise<string | undefined> {
	if (target.kind === 'android') {
		const exit = await latestExit(target, run);

		return exit && exit.timestamp !== baseline.lastExit
			? `Discord exited (${exit.reason.toLowerCase()} at ${exit.timestamp})`
			: undefined;
	}

	const added = [...(await crashFiles(target, run))].filter(
		(file) => !baseline.crashFiles.has(file),
	);
	const reasons: string[] = [];

	for (const file of added.sort()) {
		if (file.startsWith('JetsamEvent-')) {
			const { stdout } = await run(iosShell(target, `cat ${CRASH_DIRECTORY}/${file}`));
			const kills = parseJetsamKills(shellOutput(stdout));

			reasons.push(kills.length ? `jetsam killed ${kills.join(', ')}` : 'a jetsam event');
		} else if (file.startsWith('Discord')) {
			reasons.push(`Discord crashed (${file})`);
		}
	}

	return reasons.length ? reasons.join('; ') : undefined;
}

/**
 * @description The commands that bring Discord back to the front after a drop.
 * @param target The device.
 * @returns The commands to run in order.
 */
export function relaunchCommands(target: DropTarget): string[][] {
	if (target.kind === 'android') {
		return [
			adb(
				target,
				'shell',
				'monkey',
				'-p',
				ANDROID_PACKAGE,
				'-c',
				'android.intent.category.LAUNCHER',
				'1',
			),
		];
	}

	return [
		[
			'jb-p1lot',
			'ui_action',
			'--device',
			target.udid,
			'--action',
			'button',
			'--button',
			'home',
		],
		iosShell(target, `/var/jb/usr/bin/uiopen --bundleid ${IOS_BUNDLE}`),
	];
}
