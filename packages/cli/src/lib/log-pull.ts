import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { join, resolve } from 'node:path';

import {
	ERROR_MARKER,
	IOS_TIMEOUTS,
	pickDevice,
	pilotShell,
	readMarker,
	resolvePilot,
} from '~/lib/pilot';
import {
	ANDROID_FILES_DIRECTORY,
	DISCORD_BUNDLE_ID,
	IOS_CONTAINERS_DIRECTORY,
} from '~/lib/device-paths';
import type { CommandResult, CommandRunner } from '~/lib/run-command';
import { ANDROID_TIMEOUTS } from '~/lib/android-install';
import { runCommand } from '~/lib/run-command';

export const ANDROID_LOGS_DIRECTORY = `${ANDROID_FILES_DIRECTORY}/Unbound/Logs`;

const ANDROID_STAGING_DIRECTORY = '/data/local/tmp/ubd-logs';
const IOS_STAGING_DIRECTORY = '/var/tmp/ubd-logs';
const FILE_MARKER = 'UBD_LOG_FILE=';

export type LogPullOptions = {
	out: string;
	run?: CommandRunner;
};

export type AndroidLogPullOptions = LogPullOptions & { serial?: string };

export type IOSLogPullOptions = LogPullOptions & { udid?: string; pilot?: string };

/**
 * @description Copies Unbound's on-device log files off a rooted Android device: they are staged as
 * root in `/data/local/tmp`, since Discord's data is private, pulled with adb, then removed.
 * @param options Where to write the files, the device serial and the command runner.
 * @returns Which files landed where, or the step that failed.
 */
export async function pullAndroidLogs(options: AndroidLogPullOptions): Promise<CommandOutput> {
	const { serial, run = runCommand } = options;

	function adb(args: string[], timeoutMs: number): Promise<CommandResult> {
		return run('adb', [...(serial ? ['-s', serial] : []), ...args], timeoutMs);
	}

	const identity = await adb(['shell', 'id -u'], ANDROID_TIMEOUTS.state);

	if (!identity.ok) {
		return { ok: false, text: `No Android device is ready over adb. ${identity.error}` };
	}

	const script = androidStageScript();
	const staged = await adb(
		['shell', identity.stdout.trim() === '0' ? script : `su -c '${script}'`],
		ANDROID_TIMEOUTS.shell,
	);
	const missing = staged.ok ? readMarker(staged.stdout, ERROR_MARKER) : void 0;

	if (!staged.ok || missing) {
		return {
			ok: false,
			text:
				missing ??
				`${staged.ok ? '' : staged.error} Root is needed to read Discord's data.`,
		};
	}

	const directory = prepareOutput(options.out);
	const pulled = await adb(
		['pull', `${ANDROID_STAGING_DIRECTORY}/.`, directory],
		ANDROID_TIMEOUTS.push,
	);

	await adb(['shell', `rm -rf ${ANDROID_STAGING_DIRECTORY}`], ANDROID_TIMEOUTS.shell);

	return pulled.ok ? describePulled(directory) : { ok: false, text: pulled.error };
}

/**
 * @description Copies Unbound's on-device log files off a jailbroken iPhone through `jb-p1lot`: they
 * are staged in `/var/tmp` from whichever data container belongs to Discord, transferred one file at
 * a time, since each stays under the transfer limit, then removed.
 * @param options Where to write the files, the device UDID and the runner and binary to use.
 * @returns Which files landed where, or the step that failed.
 */
export async function pullIOSLogs(options: IOSLogPullOptions): Promise<CommandOutput> {
	const { run = runCommand, pilot = resolvePilot() } = options;

	function pilotCommand(args: string[], timeoutMs: number): Promise<CommandResult> {
		return run(pilot, args, timeoutMs);
	}

	const picked = options.udid ?? (await pickDevice(pilotCommand));

	if (typeof picked !== 'string') {
		return { ok: false, text: picked.error };
	}

	const device = picked;
	const target = { udid: device, pilot, run };
	const staged = await pilotShell(target, iosStageScript());
	const output = staged.ok ? staged.output : staged.error;
	const files = listMarked(output, FILE_MARKER);

	if (!staged.ok || files.length === 0) {
		return {
			ok: false,
			text:
				readMarker(output, ERROR_MARKER) ??
				`Staging the logs on ${device} failed: ${output.trim()}`,
		};
	}

	const directory = prepareOutput(options.out);

	for (const file of files) {
		const transferred = await pilotCommand(
			[
				'file_transfer',
				'--device',
				device,
				'--direction',
				'device_to_host',
				'--source',
				`${IOS_STAGING_DIRECTORY}/${file}`,
				'--destination',
				join(directory, file),
			],
			IOS_TIMEOUTS.transfer,
		);

		if (!transferred.ok) {
			return { ok: false, text: transferred.error };
		}
	}

	await pilotShell(target, `rm -rf ${IOS_STAGING_DIRECTORY}`);

	return describePulled(directory);
}

/**
 * @description Builds the Android root script that copies the log folder somewhere adb can read it.
 * @returns The shell script, which prints why it failed when there are no logs.
 */
export function androidStageScript(): string {
	return [
		`if [ ! -d ${ANDROID_LOGS_DIRECTORY} ]; then echo "${ERROR_MARKER}Discord has no Unbound log files yet. Launch Discord with this loader once, then retry."; exit 0; fi`,
		`rm -rf ${ANDROID_STAGING_DIRECTORY}`,
		`cp -r ${ANDROID_LOGS_DIRECTORY} ${ANDROID_STAGING_DIRECTORY}`,
		`chmod 755 ${ANDROID_STAGING_DIRECTORY}`,
		`chmod 644 ${ANDROID_STAGING_DIRECTORY}/*`,
	].join(' && ');
}

/**
 * @description Builds the iOS script that finds Discord's log folder and stages its files in `/var/tmp`.
 * @returns The shell script, which prints each staged file's name or why it failed.
 */
export function iosStageScript(): string {
	return [
		`root=''`,
		`for plist in $(grep -l '${DISCORD_BUNDLE_ID}' ${IOS_CONTAINERS_DIRECTORY}/*/.com.apple.mobile_container_manager.metadata.plist 2>/dev/null); do`,
		`if [ -d "\${plist%/*}/Documents/Unbound/Logs" ]; then root="\${plist%/*}/Documents/Unbound/Logs"; break; fi`,
		'done',
		`if [ -z "$root" ]; then echo '${ERROR_MARKER}Discord has no Unbound log files yet. Launch Discord with this loader once, then retry.'; exit 1; fi`,
		`rm -rf ${IOS_STAGING_DIRECTORY} && mkdir -p ${IOS_STAGING_DIRECTORY} && cp "$root"/*.log ${IOS_STAGING_DIRECTORY}/ && chmod 644 ${IOS_STAGING_DIRECTORY}/*`,
		`for file in ${IOS_STAGING_DIRECTORY}/*.log; do echo "${FILE_MARKER}\${file##*/}"; done`,
	].join('\n');
}

const SYMBOLICATED_SUFFIX = '.symbolicated.log';

/**
 * @description Writes a symbolicated copy next to each pulled log file, mapping Hermes frames of the client bundle to source positions.
 * @param directory The folder the logs were pulled into.
 * @param rewrite Rewrites one log line's frames.
 * @returns The names of the copies written.
 */
export function symbolicatePulledLogs(
	directory: string,
	rewrite: (line: string) => string,
): string[] {
	const written: string[] = [];

	for (const file of readdirSync(directory).sort()) {
		if (!file.endsWith('.log') || file.endsWith(SYMBOLICATED_SUFFIX)) {
			continue;
		}

		const lines = readFileSync(join(directory, file), 'utf8').split('\n');
		const name = file.replace(/\.log$/, SYMBOLICATED_SUFFIX);

		writeFileSync(join(directory, name), lines.map(rewrite).join('\n'));
		written.push(name);
	}

	return written;
}

/**
 * @description Names the default folder logs are pulled into, stamped so pulls never overwrite each other.
 * @param now The time to stamp the folder with.
 * @returns A folder name such as `unbound-logs-20261027-210000`.
 */
export function defaultLogFolder(now: Date = new Date()): string {
	const stamp = now
		.toISOString()
		.replace(/\.\d+Z$/, '')
		.replaceAll('-', '')
		.replaceAll(':', '')
		.replace('T', '-');

	return `unbound-logs-${stamp}`;
}

function prepareOutput(out: string): string {
	const directory = resolve(out);

	mkdirSync(directory, { recursive: true });

	return directory;
}

function describePulled(directory: string): CommandOutput {
	const files = readdirSync(directory)
		.filter((file) => file.endsWith('.log') && !file.endsWith(SYMBOLICATED_SUFFIX))
		.sort();

	return files.length
		? {
				ok: true,
				text: `Pulled ${files.join(', ')} into ${directory}.`,
				data: { directory, files },
			}
		: { ok: false, text: `No log files arrived in ${directory}.` };
}

function listMarked(output: string, marker: string): string[] {
	return output
		.split('\n')
		.filter((line) => line.startsWith(marker))
		.map((line) => line.slice(marker.length).trim())
		.filter(Boolean);
}

export default { pullAndroidLogs, pullIOSLogs };
