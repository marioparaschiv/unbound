import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	ANDROID_FILES_DIRECTORY,
	DISCORD_BUNDLE_ID,
	DISCORD_PACKAGE,
	IOS_CONTAINERS_DIRECTORY,
	IOS_TAR,
	IOS_UIOPEN,
} from '~/lib/device-paths';
import {
	ERROR_MARKER,
	IOS_TIMEOUTS,
	pickDevice,
	pilotShell,
	readMarker,
	resolvePilot,
} from '~/lib/pilot';
import type { CommandResult, CommandRunner } from '~/lib/run-command';
import { ANDROID_TIMEOUTS } from '~/lib/android-install';
import { runCommand } from '~/lib/run-command';

const ANDROID_STAGING = '/data/local/tmp';
const IOS_STAGING = '/var/tmp';
const IOS_GZIP = '/var/jb/usr/bin/gzip';
const IOS_SPLIT = '/var/jb/usr/bin/split';
const IOS_PART_BYTES = 2 * 1024 * 1024;
const RESULT_MARKER = 'UBD_RESULT=';
const SNAPSHOT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const TRANSFER_TIMEOUT_MS = 600_000;

export type DevicePlatform = 'android' | 'ios';

export type DeviceStateOptions = {
	serial?: string;
	ios?: boolean;
	udid?: string;
	restart?: boolean;
	run?: CommandRunner;
	pilot?: string;
	snapshotRoot?: string;
};

type ScriptResult = { ok: true; value: string } | { ok: false; error: string };

type DeviceTarget = {
	platform: DevicePlatform;
	id: string;
	parentScript: string;
	staging: string;
	packCommand: (archive: string) => string;
	unpackCommand: (archive: string) => string;
	ownerScript: string;
	stopScript: string;
	startScript: string;
	run(script: string, timeoutMs: number): Promise<ScriptResult>;
	push(local: string, remote: string): Promise<CommandResult>;
	pull(remote: string, local: string): Promise<CommandResult>;
};

function scriptResult(ok: boolean, output: string, error: string): ScriptResult {
	const value = readMarker(output, RESULT_MARKER);

	if (ok && value !== undefined) {
		return { ok: true, value };
	}

	return {
		ok: false,
		error: readMarker(output, ERROR_MARKER) ?? (error.trim() || output.trim()),
	};
}

/**
 * @description The folder snapshots of one device are kept in on this computer.
 * @param platform The device's platform.
 * @param id The device's adb serial or UDID.
 * @param root The snapshot store, `~/.unbound/device-snapshots` by default.
 * @returns The folder.
 */
export function snapshotDirectory(
	platform: DevicePlatform,
	id: string,
	root = join(homedir(), '.unbound', 'device-snapshots'),
): string {
	return join(root, `${platform}-${id.replace(/[^A-Za-z0-9._-]/g, '_')}`);
}

/**
 * @description Checks a snapshot name, which becomes a file name on this computer and the device.
 * @param name The name.
 * @returns Whether it is safe to use.
 */
export function isSnapshotName(name: string): boolean {
	return SNAPSHOT_NAME.test(name);
}

/**
 * @description Builds the device script that moves Unbound's folder aside, so Discord starts with a fresh one.
 * @param target The device.
 * @returns The script, which prints where the old folder went.
 */
export function resetScript(target: Pick<DeviceTarget, 'parentScript' | 'stopScript'>): string {
	return [
		target.parentScript,
		target.stopScript,
		'stamp=$(date +%Y%m%d-%H%M%S)',
		'if [ ! -d "$parent/Unbound" ]; then echo "UBD_RESULT=none"; exit 0; fi',
		'mv "$parent/Unbound" "$parent/Unbound.reset-$stamp" && echo "UBD_RESULT=$parent/Unbound.reset-$stamp"',
	].join('\n');
}

/**
 * @description Builds the device script that archives Unbound's folder for a snapshot.
 * @param target The device.
 * @param archive Where to write the archive on the device.
 * @returns The script, which prints the archive's path.
 */
export function saveScript(
	target: Pick<DeviceTarget, 'parentScript' | 'packCommand'>,
	archive: string,
): string {
	return [
		target.parentScript,
		`if [ ! -d "$parent/Unbound" ]; then echo '${ERROR_MARKER}Discord has no Unbound folder yet. Launch it with Unbound once, then retry.'; exit 1; fi`,
		`${target.packCommand(archive)} && echo "UBD_RESULT=${archive}"`,
	].join('\n');
}

/**
 * @description Builds the device script that replaces Unbound's folder with a snapshot, keeping the current one aside.
 * @param target The device.
 * @param archive The staged snapshot archive on the device.
 * @returns The script, which prints where the replaced folder went.
 */
export function restoreScript(
	target: Pick<DeviceTarget, 'parentScript' | 'stopScript' | 'unpackCommand' | 'ownerScript'>,
	archive: string,
): string {
	return [
		target.parentScript,
		target.stopScript,
		'stamp=$(date +%Y%m%d-%H%M%S)',
		'aside=none',
		'if [ -d "$parent/Unbound" ]; then mv "$parent/Unbound" "$parent/Unbound.before-restore-$stamp" && aside="$parent/Unbound.before-restore-$stamp"; fi',
		target.unpackCommand(archive),
		'status=$?',
		`rm -f '${archive}'`,
		`if [ $status -ne 0 ]; then echo '${ERROR_MARKER}Unpacking the snapshot failed.'; exit 1; fi`,
		target.ownerScript,
		'echo "UBD_RESULT=$aside"',
	].join('\n');
}

function androidTarget(
	serial: string | undefined,
	run: CommandRunner,
	asRoot: boolean,
): DeviceTarget {
	const adb = (args: string[], timeoutMs: number) =>
		run('adb', [...(serial ? ['-s', serial] : []), ...args], timeoutMs);

	return {
		platform: 'android',
		id: serial ?? 'device',
		parentScript: `parent='${ANDROID_FILES_DIRECTORY}'`,
		staging: ANDROID_STAGING,
		packCommand: (archive) => `tar -czf '${archive}' -C "$parent" Unbound`,
		unpackCommand: (archive) => `tar -xzf '${archive}' -C "$parent"`,
		ownerScript: 'chown -R $(stat -c %u:%g "$parent") "$parent/Unbound"',
		stopScript: `am force-stop ${DISCORD_PACKAGE}`,
		startScript: `monkey -p ${DISCORD_PACKAGE} -c android.intent.category.LAUNCHER 1 >/dev/null`,
		async run(script, timeoutMs) {
			const quoted = script.replaceAll("'", "'\\''");
			const result = await adb(['shell', asRoot ? script : `su -c '${quoted}'`], timeoutMs);

			return result.ok
				? scriptResult(true, result.stdout, '')
				: scriptResult(false, '', result.error);
		},
		push: (local, remote) => adb(['push', local, remote], TRANSFER_TIMEOUT_MS),
		pull: (remote, local) => adb(['pull', remote, local], TRANSFER_TIMEOUT_MS),
	};
}

type Transfer = (
	direction: 'host_to_device' | 'device_to_host',
	source: string,
	destination: string,
) => Promise<CommandResult>;

type Shell = (script: string) => Promise<ScriptResult>;

/**
 * @description Copies a device file to this computer in parts small enough for one jb-p1lot frame.
 * @param remote The file on the device.
 * @param local Where to write it here.
 * @param transfer Copies one file across.
 * @param shell Runs a device script.
 * @returns Whether every part arrived.
 */
export async function pullInParts(
	remote: string,
	local: string,
	transfer: Transfer,
	shell: Shell,
): Promise<CommandResult> {
	const split = await shell(
		`${IOS_SPLIT} -b ${IOS_PART_BYTES} '${remote}' '${remote}.part-' && echo "UBD_RESULT=$(ls '${remote}'.part-* | tr '\\n' ' ')"`,
	);

	if (!split.ok) {
		return { ok: false, error: split.error };
	}

	const parts = split.value.split(' ').filter(Boolean).sort();
	const chunks: Buffer[] = [];
	const directory = mkdtempSync(join(tmpdir(), 'ubd-pull-'));

	try {
		for (const part of parts) {
			const destination = join(directory, part.slice(part.lastIndexOf('/') + 1));
			const copied = await transfer('device_to_host', part, destination);

			if (!copied.ok) {
				return copied;
			}

			chunks.push(readFileSync(destination));
		}

		writeFileSync(local, Buffer.concat(chunks));

		return { ok: true, stdout: local };
	} finally {
		rmSync(directory, { recursive: true, force: true });
		await shell(`rm -f '${remote}'.part-*\necho "UBD_RESULT=removed"`);
	}
}

/**
 * @description Copies a file here to the device in parts small enough for one jb-p1lot frame, then joins them.
 * @param local The file here.
 * @param remote Where to write it on the device.
 * @param transfer Copies one file across.
 * @param shell Runs a device script.
 * @returns Whether the joined file arrived.
 */
export async function pushInParts(
	local: string,
	remote: string,
	transfer: Transfer,
	shell: Shell,
): Promise<CommandResult> {
	const data = readFileSync(local);
	const directory = mkdtempSync(join(tmpdir(), 'ubd-push-'));
	const parts: string[] = [];

	try {
		for (
			let offset = 0, index = 0;
			offset < data.length || index === 0;
			offset += IOS_PART_BYTES, index++
		) {
			const name = `part-${String(index).padStart(4, '0')}`;
			const source = join(directory, name);
			const destination = `${remote}.${name}`;

			writeFileSync(source, data.subarray(offset, offset + IOS_PART_BYTES));

			const copied = await transfer('host_to_device', source, destination);

			if (!copied.ok) {
				return copied;
			}

			parts.push(destination);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}

	const joined = await shell(
		`cat ${parts.map((part) => `'${part}'`).join(' ')} > '${remote}' && rm -f ${parts.map((part) => `'${part}'`).join(' ')} && echo "UBD_RESULT=${remote}"`,
	);

	return joined.ok ? { ok: true, stdout: remote } : { ok: false, error: joined.error };
}

function iosTarget(udid: string, run: CommandRunner, pilot: string): DeviceTarget {
	const device = { udid, pilot, run };
	const transfer: Transfer = (direction, source, destination) =>
		run(
			pilot,
			[
				'file_transfer',
				'--device',
				udid,
				'--direction',
				direction,
				'--source',
				source,
				'--destination',
				destination,
			],
			TRANSFER_TIMEOUT_MS,
		);

	async function runScript(script: string, timeoutMs: number): Promise<ScriptResult> {
		const result = await pilotShell(device, script, { timeoutMs, onDevice: true });

		return result.ok
			? scriptResult(true, result.output, '')
			: scriptResult(false, '', result.error);
	}

	const shell: Shell = (script) => runScript(script, TRANSFER_TIMEOUT_MS);

	return {
		platform: 'ios',
		id: udid,
		parentScript: [
			"parent=''",
			`for plist in $(grep -l '${DISCORD_BUNDLE_ID}' ${IOS_CONTAINERS_DIRECTORY}/*/.com.apple.mobile_container_manager.metadata.plist 2>/dev/null); do parent="\${plist%/*}/Documents"; break; done`,
			`if [ -z "$parent" ]; then echo '${ERROR_MARKER}Discord has no data container on this device.'; exit 1; fi`,
		].join('\n'),
		staging: IOS_STAGING,
		packCommand: (archive) =>
			`${IOS_TAR} -cf - -C "$parent" Unbound | ${IOS_GZIP} > '${archive}'`,
		unpackCommand: (archive) =>
			`${IOS_GZIP} -dc '${archive}' | ${IOS_TAR} -xf - -C "$parent" --no-same-owner`,
		ownerScript: 'chown -R mobile:mobile "$parent/Unbound"',
		stopScript: 'killall -9 Discord 2>/dev/null; sleep 1',
		startScript: `${IOS_UIOPEN} --bundleid ${DISCORD_BUNDLE_ID}`,
		run: runScript,
		push: (local, remote) => pushInParts(local, remote, transfer, shell),
		pull: (remote, local) => pullInParts(remote, local, transfer, shell),
	};
}

async function resolveTarget(
	options: DeviceStateOptions,
): Promise<DeviceTarget | { error: string }> {
	const run = options.run ?? runCommand;
	const onIOS = options.ios || options.udid !== undefined;

	if (onIOS && options.serial !== undefined) {
		return {
			error: 'Pass either --serial for an Android device or --ios/--udid for an iPhone, not both.',
		};
	}

	if (onIOS) {
		const pilot = options.pilot ?? resolvePilot();
		const udid =
			options.udid ?? (await pickDevice((args, timeoutMs) => run(pilot, args, timeoutMs)));

		return typeof udid === 'string' ? iosTarget(udid, run, pilot) : udid;
	}

	const adbArgs = options.serial ? ['-s', options.serial] : [];
	const state = await run('adb', [...adbArgs, 'get-state'], ANDROID_TIMEOUTS.state);

	if (!state.ok) {
		return { error: `No Android device is ready over adb. ${state.error}` };
	}

	const identity = await run('adb', [...adbArgs, 'shell', 'id -u'], ANDROID_TIMEOUTS.shell);
	const serial = options.serial ?? (await run('adb', ['get-serialno'], ANDROID_TIMEOUTS.state));

	return androidTarget(
		typeof serial === 'string' ? serial : serial.ok ? serial.stdout.trim() : undefined,
		run,
		identity.ok && identity.stdout.trim() === '0',
	);
}

async function restartIfAsked(target: DeviceTarget, restart: boolean | undefined): Promise<string> {
	if (!restart) {
		return ' Launch Discord to load it.';
	}

	const started = await target.run(
		`${target.startScript}\necho "UBD_RESULT=started"`,
		IOS_TIMEOUTS.restart,
	);

	return started.ok ? ' Discord was restarted.' : ` Restarting Discord failed: ${started.error}`;
}

/**
 * @description Moves Discord's Unbound folder aside on a device, so the next launch starts from a fresh state.
 * Nothing is deleted: the old folder stays next to the new one as `Unbound.reset-<time>`.
 * @param options The device and whether to restart Discord.
 * @returns Where the old folder went, or why the reset failed.
 */
export async function resetDevice(options: DeviceStateOptions): Promise<CommandOutput> {
	const target = await resolveTarget(options);

	if ('error' in target) {
		return { ok: false, text: target.error };
	}

	const moved = await target.run(resetScript(target), ANDROID_TIMEOUTS.shell);

	if (!moved.ok) {
		return { ok: false, text: `Resetting ${target.id} failed: ${moved.error}` };
	}

	const where =
		moved.value === 'none'
			? 'Discord had no Unbound folder yet.'
			: `Moved Unbound's folder to ${moved.value}.`;

	return { ok: true, text: `${where}${await restartIfAsked(target, options.restart)}` };
}

/**
 * @description Saves Discord's Unbound folder on a device as a named snapshot on this computer.
 * @param name The snapshot's name.
 * @param options The device and where snapshots are kept.
 * @returns Where the snapshot was saved, or why it failed.
 */
export async function saveSnapshot(
	name: string,
	options: DeviceStateOptions,
): Promise<CommandOutput> {
	if (!isSnapshotName(name)) {
		return {
			ok: false,
			text: 'Name the snapshot with letters, digits, dots, dashes or underscores.',
		};
	}

	const target = await resolveTarget(options);

	if ('error' in target) {
		return { ok: false, text: target.error };
	}

	const directory = snapshotDirectory(target.platform, target.id, options.snapshotRoot);
	const local = join(directory, `${name}.tar.gz`);
	const remote = `${target.staging}/ubd-snapshot-${name}-${crypto.randomUUID()}.tar.gz`;
	const archived = await target.run(saveScript(target, remote), TRANSFER_TIMEOUT_MS);

	if (!archived.ok) {
		return { ok: false, text: `Archiving Unbound on ${target.id} failed: ${archived.error}` };
	}

	mkdirSync(directory, { recursive: true });

	const pulled = await target.pull(remote, local);

	await target.run(`rm -f '${remote}'\necho "UBD_RESULT=removed"`, ANDROID_TIMEOUTS.shell);

	return pulled.ok
		? { ok: true, text: `Saved ${target.id}'s Unbound state as ${name} (${local}).` }
		: { ok: false, text: `Copying the snapshot from ${target.id} failed: ${pulled.error}` };
}

/**
 * @description Replaces Discord's Unbound folder on a device with a saved snapshot. The current folder
 * stays on the device as `Unbound.before-restore-<time>`.
 * @param name The snapshot's name.
 * @param options The device, where snapshots are kept, and whether to restart Discord.
 * @returns What was restored, or why it failed.
 */
export async function restoreSnapshot(
	name: string,
	options: DeviceStateOptions,
): Promise<CommandOutput> {
	if (!isSnapshotName(name)) {
		return {
			ok: false,
			text: 'Name the snapshot with letters, digits, dots, dashes or underscores.',
		};
	}

	const target = await resolveTarget(options);

	if ('error' in target) {
		return { ok: false, text: target.error };
	}

	const local = join(
		snapshotDirectory(target.platform, target.id, options.snapshotRoot),
		`${name}.tar.gz`,
	);

	if (!existsSync(local)) {
		return { ok: false, text: `There is no snapshot named ${name} for ${target.id}.` };
	}

	const remote = `${target.staging}/ubd-restore-${name}-${crypto.randomUUID()}.tar.gz`;
	const pushed = await target.push(local, remote);

	if (!pushed.ok) {
		return { ok: false, text: `Copying the snapshot to ${target.id} failed: ${pushed.error}` };
	}

	const restored = await target.run(restoreScript(target, remote), TRANSFER_TIMEOUT_MS);

	if (!restored.ok) {
		return { ok: false, text: `Restoring ${name} on ${target.id} failed: ${restored.error}` };
	}

	const aside =
		restored.value === 'none' ? '' : ` The previous state is kept at ${restored.value}.`;

	return {
		ok: true,
		text: `Restored ${name} on ${target.id}.${aside}${await restartIfAsked(target, options.restart)}`,
	};
}

/**
 * @description Lists the snapshots saved on this computer, for every device or one.
 * @param root The snapshot store, `~/.unbound/device-snapshots` by default.
 * @returns One line per snapshot with its device, name, size and date.
 */
export function listSnapshots(
	root = join(homedir(), '.unbound', 'device-snapshots'),
): CommandOutput {
	if (!existsSync(root)) {
		return { ok: true, text: 'No device snapshots are saved yet.' };
	}

	const lines = readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.flatMap((device) =>
			readdirSync(join(root, device.name))
				.filter((file) => file.endsWith('.tar.gz'))
				.map((file) => {
					const stats = statSync(join(root, device.name, file));
					const size = `${(stats.size / 1_048_576).toFixed(1)} MB`;

					return `${device.name}  ${file.slice(0, -'.tar.gz'.length)}  ${size}  ${stats.mtime.toISOString()}`;
				}),
		)
		.sort();

	return {
		ok: true,
		text: lines.length ? lines.join('\n') : 'No device snapshots are saved yet.',
	};
}
