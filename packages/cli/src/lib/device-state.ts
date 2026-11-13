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
	IOS_CONTAINERS_DIRECTORY,
	IOS_GZIP,
	IOS_SPLIT,
	IOS_TAR,
} from '~/lib/device-paths';
import type { DevicePlatform, DeviceTarget } from '~/lib/device-target';
import { ANDROID_TIMEOUTS } from '~/lib/android-target';
import { ERROR_MARKER, readMarker } from '~/lib/pilot';
import type { CommandResult } from '~/lib/run-command';
import { failure } from '~/lib/command-error';

const IOS_PART_BYTES = 2 * 1024 * 1024;
const RESULT_MARKER = 'UBD_RESULT=';
const SNAPSHOT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const TRANSFER_TIMEOUT_MS = 600_000;

export type DeviceStateOptions = {
	restart?: boolean;
	snapshotRoot?: string;
};

type ScriptResult = { ok: true; value: string } | { ok: false; error: string };

/** The scripts that find, pack, unpack and hand back Discord's Unbound folder on one platform. */
type SnapshotScripts = {
	parentScript: string;
	packCommand: (archive: string) => string;
	unpackCommand: (archive: string) => string;
	ownerScript: string;
};

type SnapshotTarget = SnapshotScripts & { stopScript: string };

const SNAPSHOT_SCRIPTS: Record<DevicePlatform, SnapshotScripts> = {
	android: {
		parentScript: `parent='${ANDROID_FILES_DIRECTORY}'`,
		packCommand: (archive) => `tar -czf '${archive}' -C "$parent" Unbound`,
		unpackCommand: (archive) => `tar -xzf '${archive}' -C "$parent"`,
		ownerScript: 'chown -R $(stat -c %u:%g "$parent") "$parent/Unbound"',
	},
	ios: {
		parentScript: [
			"parent=''",
			`for plist in $(grep -l '${DISCORD_BUNDLE_ID}' ${IOS_CONTAINERS_DIRECTORY}/*/.com.apple.mobile_container_manager.metadata.plist 2>/dev/null); do parent="\${plist%/*}/Documents"; break; done`,
			`if [ -z "$parent" ]; then echo '${ERROR_MARKER}Discord has no data container on this device.'; exit 1; fi`,
		].join('\n'),
		packCommand: (archive) =>
			`${IOS_TAR} -cf - -C "$parent" Unbound | ${IOS_GZIP} > '${archive}'`,
		unpackCommand: (archive) =>
			`${IOS_GZIP} -dc '${archive}' | ${IOS_TAR} -xf - -C "$parent" --no-same-owner`,
		ownerScript: 'chown -R mobile:mobile "$parent/Unbound"',
	},
};

function snapshotTarget(target: DeviceTarget): SnapshotTarget {
	return { ...SNAPSHOT_SCRIPTS[target.platform], stopScript: target.stopDiscordScript };
}

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

async function runScript(
	target: Pick<DeviceTarget, 'shell'>,
	script: string,
	timeoutMs?: number,
): Promise<ScriptResult> {
	const result = await target.shell(script, timeoutMs);

	return result.ok
		? scriptResult(true, result.output, '')
		: scriptResult(false, '', result.error);
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
export function resetScript(target: Pick<SnapshotTarget, 'parentScript' | 'stopScript'>): string {
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
	target: Pick<SnapshotTarget, 'parentScript' | 'packCommand'>,
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
	target: Pick<SnapshotTarget, 'parentScript' | 'stopScript' | 'unpackCommand' | 'ownerScript'>,
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

/**
 * @description Copies a device file to this computer in parts small enough for one jb-p1lot frame.
 * @param remote The file on the device.
 * @param local Where to write it here.
 * @param target The device.
 * @returns Whether every part arrived.
 */
export async function pullInParts(
	remote: string,
	local: string,
	target: Pick<DeviceTarget, 'pull' | 'shell'>,
): Promise<CommandResult> {
	const split = await runScript(
		target,
		`${IOS_SPLIT} -b ${IOS_PART_BYTES} '${remote}' '${remote}.part-' && echo "UBD_RESULT=$(ls '${remote}'.part-* | tr '\\n' ' ')"`,
		TRANSFER_TIMEOUT_MS,
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
			const copied = await target.pull(part, destination, TRANSFER_TIMEOUT_MS);

			if (!copied.ok) {
				return copied;
			}

			chunks.push(readFileSync(destination));
		}

		writeFileSync(local, Buffer.concat(chunks));

		return { ok: true, stdout: local };
	} finally {
		rmSync(directory, { recursive: true, force: true });
		await runScript(
			target,
			`rm -f '${remote}'.part-*\necho "UBD_RESULT=removed"`,
			TRANSFER_TIMEOUT_MS,
		);
	}
}

/**
 * @description Copies a file here to the device in parts small enough for one jb-p1lot frame, then joins them.
 * @param local The file here.
 * @param remote Where to write it on the device.
 * @param target The device.
 * @returns Whether the joined file arrived.
 */
export async function pushInParts(
	local: string,
	remote: string,
	target: Pick<DeviceTarget, 'push' | 'shell'>,
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

			const copied = await target.push(source, destination, TRANSFER_TIMEOUT_MS);

			if (!copied.ok) {
				return copied;
			}

			parts.push(destination);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}

	const joined = await runScript(
		target,
		`cat ${parts.map((part) => `'${part}'`).join(' ')} > '${remote}' && rm -f ${parts.map((part) => `'${part}'`).join(' ')} && echo "UBD_RESULT=${remote}"`,
		TRANSFER_TIMEOUT_MS,
	);

	return joined.ok ? { ok: true, stdout: remote } : { ok: false, error: joined.error };
}

// jb-p1lot carries a limited frame, so an iPhone moves snapshot archives in parts.
function pushArchive(target: DeviceTarget, local: string, remote: string) {
	return target.platform === 'ios'
		? pushInParts(local, remote, target)
		: target.push(local, remote, TRANSFER_TIMEOUT_MS);
}

function pullArchive(target: DeviceTarget, remote: string, local: string) {
	return target.platform === 'ios'
		? pullInParts(remote, local, target)
		: target.pull(remote, local, TRANSFER_TIMEOUT_MS);
}

// Snapshots are kept per device, so an Android device picked without --serial is named by its serial.
async function snapshotOwner(target: DeviceTarget): Promise<string> {
	if (target.platform === 'ios') {
		return target.udid;
	}

	if (target.serial) {
		return target.serial;
	}

	const serial = await target.adb.run(['get-serialno'], ANDROID_TIMEOUTS.state);

	return (serial.ok && serial.stdout.trim()) || 'device';
}

async function restartIfAsked(target: DeviceTarget, restart: boolean | undefined): Promise<string> {
	if (!restart) {
		return ' Launch Discord to load it.';
	}

	const started = await target.restartDiscord();

	return started.ok ? ' Discord was restarted.' : ` Restarting Discord failed: ${started.error}`;
}

/**
 * @description Moves Discord's Unbound folder aside on a device, so the next launch starts from a fresh state.
 * Nothing is deleted: the old folder stays next to the new one as `Unbound.reset-<time>`.
 * @param target The device.
 * @param options Whether to restart Discord.
 * @returns Where the old folder went, or why the reset failed.
 */
export async function resetDevice(
	target: DeviceTarget,
	options: DeviceStateOptions = {},
): Promise<CommandOutput> {
	const moved = await runScript(target, resetScript(snapshotTarget(target)));

	if (!moved.ok) {
		return failure('tool-failed', `Resetting ${target.id} failed: ${moved.error}`);
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
 * @param target The device.
 * @param options Where snapshots are kept.
 * @returns Where the snapshot was saved, or why it failed.
 */
export async function saveSnapshot(
	name: string,
	target: DeviceTarget,
	options: DeviceStateOptions = {},
): Promise<CommandOutput> {
	if (!isSnapshotName(name)) {
		return failure(
			'invalid-input',
			'Name the snapshot with letters, digits, dots, dashes or underscores.',
			{ field: 'name' },
		);
	}

	const owner = await snapshotOwner(target);
	const directory = snapshotDirectory(target.platform, owner, options.snapshotRoot);
	const local = join(directory, `${name}.tar.gz`);
	const remote = `${target.staging}/ubd-snapshot-${name}-${crypto.randomUUID()}.tar.gz`;
	const archived = await runScript(
		target,
		saveScript(snapshotTarget(target), remote),
		TRANSFER_TIMEOUT_MS,
	);

	if (!archived.ok) {
		return failure('tool-failed', `Archiving Unbound on ${owner} failed: ${archived.error}`);
	}

	mkdirSync(directory, { recursive: true });

	const pulled = await pullArchive(target, remote, local);

	await runScript(target, `rm -f '${remote}'\necho "UBD_RESULT=removed"`);

	return pulled.ok
		? { ok: true, text: `Saved ${owner}'s Unbound state as ${name} (${local}).` }
		: failure('tool-failed', `Copying the snapshot from ${owner} failed: ${pulled.error}`);
}

/**
 * @description Replaces Discord's Unbound folder on a device with a saved snapshot. The current folder
 * stays on the device as `Unbound.before-restore-<time>`.
 * @param name The snapshot's name.
 * @param target The device.
 * @param options Where snapshots are kept, and whether to restart Discord.
 * @returns What was restored, or why it failed.
 */
export async function restoreSnapshot(
	name: string,
	target: DeviceTarget,
	options: DeviceStateOptions = {},
): Promise<CommandOutput> {
	if (!isSnapshotName(name)) {
		return failure(
			'invalid-input',
			'Name the snapshot with letters, digits, dots, dashes or underscores.',
			{ field: 'name' },
		);
	}

	const owner = await snapshotOwner(target);
	const local = join(
		snapshotDirectory(target.platform, owner, options.snapshotRoot),
		`${name}.tar.gz`,
	);

	if (!existsSync(local)) {
		return failure('not-found', `There is no snapshot named ${name} for ${owner}.`, {
			field: 'name',
		});
	}

	const remote = `${target.staging}/ubd-restore-${name}-${crypto.randomUUID()}.tar.gz`;
	const pushed = await pushArchive(target, local, remote);

	if (!pushed.ok) {
		return failure('tool-failed', `Copying the snapshot to ${owner} failed: ${pushed.error}`);
	}

	const restored = await runScript(
		target,
		restoreScript(snapshotTarget(target), remote),
		TRANSFER_TIMEOUT_MS,
	);

	if (!restored.ok) {
		return failure('tool-failed', `Restoring ${name} on ${owner} failed: ${restored.error}`);
	}

	const aside =
		restored.value === 'none' ? '' : ` The previous state is kept at ${restored.value}.`;

	return {
		ok: true,
		text: `Restored ${name} on ${owner}.${aside}${await restartIfAsked(target, options.restart)}`,
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
