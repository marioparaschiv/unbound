import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import {
	discordFolderScript,
	pullArchive,
	pushArchive,
	restartIfAsked,
	runScript,
} from '~/lib/device-state';
import type { DevicePlatform, DeviceTarget } from '~/lib/device-target';
import { IOS_GZIP, IOS_TAR } from '~/lib/device-paths';
import { runCommand } from '~/lib/run-command';
import { failure } from '~/lib/command-error';
import { ERROR_MARKER } from '~/lib/pilot';

const TRANSFER_TIMEOUT_MS = 600_000;
const LOCAL_TAR_TIMEOUT_MS = 120_000;
const UNSAFE_PATH = /['\n\\]/;

type Archiver = {
	pack: (archive: string) => string;
	unpack: (archive: string) => string;
	owner: string;
};

const ARCHIVERS: Record<DevicePlatform, Archiver> = {
	android: {
		pack: (archive) => `tar -czf '${archive}' -C "$path" .`,
		unpack: (archive) => `tar -xzf '${archive}' -C "$path"`,
		owner: 'chown -R $(stat -c %u:%g "$parent") "$path" && chcon -R "$(stat -c %C "$parent")" "$path"',
	},
	ios: {
		pack: (archive) => `${IOS_TAR} -cf - -C "$path" . | ${IOS_GZIP} > '${archive}'`,
		unpack: (archive) =>
			`${IOS_GZIP} -dc '${archive}' | ${IOS_TAR} -xf - -C "$path" --no-same-owner`,
		owner: 'chown -R mobile:mobile "$path"',
	},
};

/** The options both transfers take. */
export type DeviceFileOptions = { restart?: boolean };

/**
 * @description Builds the script line that sets `$path` to a file in Discord's data: relative paths start in the
 * folder that holds `Unbound`, so `Unbound/Logs/unbound.log` names the same file on both platforms.
 * @param path The path as given.
 * @returns The script line.
 */
export function devicePathScript(path: string): string {
	return path.startsWith('/') ? `path='${path}'` : `path="$parent/${path.replace(/^\.\//, '')}"`;
}

function unsafe(path: string): CommandOutput | undefined {
	return UNSAFE_PATH.test(path)
		? failure('invalid-input', 'Paths may not hold quotes, backslashes or new lines.', {
				field: 'path',
			})
		: undefined;
}

async function localTar(args: string[]): Promise<string | undefined> {
	const result = await runCommand('tar', args, LOCAL_TAR_TIMEOUT_MS);

	return result.ok ? undefined : result.error;
}

/**
 * @description Copies a file or folder out of Discord's data on the device to this computer. A folder travels as a
 * gzipped tar and is unpacked into `local`.
 * @param target The device.
 * @param path The file or folder, relative to the folder that holds `Unbound`, or absolute.
 * @param local Where to write it here; its name in the current folder when left out.
 * @returns Where it went, or why it failed.
 */
export async function pullFromDiscord(
	target: DeviceTarget,
	path: string,
	local?: string,
): Promise<CommandOutput> {
	const rejected = unsafe(path);

	if (rejected) {
		return rejected;
	}

	const staged = `${target.staging}/ubd-pull-${crypto.randomUUID()}`;
	const archiver = ARCHIVERS[target.platform];
	const destination = resolve(local ?? (basename(path) || 'pulled'));
	const prepared = await runScript(
		target,
		[
			discordFolderScript(target.platform),
			devicePathScript(path),
			`if [ -d "$path" ]; then ${archiver.pack(staged)} && echo "UBD_RESULT=folder"`,
			`elif [ -f "$path" ]; then cat "$path" > '${staged}' && chmod 644 '${staged}' && echo "UBD_RESULT=file"`,
			`else echo "${ERROR_MARKER}Nothing at $path."; exit 1; fi`,
		].join('\n'),
		TRANSFER_TIMEOUT_MS,
	);

	if (!prepared.ok) {
		return failure('not-found', prepared.error);
	}

	const folder = prepared.value === 'folder';
	const scratch = folder ? mkdtempSync(join(tmpdir(), 'ubd-pull-')) : undefined;
	const copy = scratch ? join(scratch, 'folder.tar.gz') : destination;

	try {
		const pulled = await pullArchive(target, staged, copy);

		if (!pulled.ok) {
			return failure(
				'tool-failed',
				`Copying ${path} from the device failed: ${pulled.error}`,
			);
		}

		if (folder) {
			mkdirSync(destination, { recursive: true });

			const error = await localTar(['-xzf', copy, '-C', destination]);

			if (error) {
				return failure('tool-failed', `Unpacking ${path} failed: ${error}`);
			}
		}

		return {
			ok: true,
			text: `Pulled ${path} to ${destination}.`,
			data: { path, local: destination },
		};
	} finally {
		if (scratch) {
			rmSync(scratch, { recursive: true, force: true });
		}

		await runScript(target, `rm -f '${staged}'\necho "UBD_RESULT=removed"`);
	}
}

/**
 * @description Copies a file or folder from this computer into Discord's data on the device, creating its folders
 * and giving it Discord's owner. A folder travels as a gzipped tar and is unpacked over `path`.
 * @param target The device.
 * @param local The file or folder here.
 * @param path Where it goes, relative to the folder that holds `Unbound`, or absolute.
 * @param options Whether to relaunch Discord afterwards.
 * @returns Where it went, or why it failed.
 */
export async function pushToDiscord(
	target: DeviceTarget,
	local: string,
	path: string,
	options: DeviceFileOptions = {},
): Promise<CommandOutput> {
	const rejected = unsafe(path);

	if (rejected) {
		return rejected;
	}

	if (!existsSync(local)) {
		return failure('not-found', `Nothing at ${local} on this computer.`, { field: 'local' });
	}

	const folder = statSync(local).isDirectory();
	const archiver = ARCHIVERS[target.platform];
	const staged = `${target.staging}/ubd-push-${crypto.randomUUID()}`;
	const scratch = folder ? mkdtempSync(join(tmpdir(), 'ubd-push-')) : undefined;

	try {
		const source = scratch ? join(scratch, 'folder.tar.gz') : local;
		const packed = scratch ? await localTar(['-czf', source, '-C', local, '.']) : undefined;

		if (packed) {
			return failure('tool-failed', `Packing ${local} failed: ${packed}`);
		}

		const pushed = await pushArchive(target, source, staged);

		if (!pushed.ok) {
			return failure('tool-failed', `Copying ${local} to the device failed: ${pushed.error}`);
		}

		const placed = await runScript(
			target,
			[
				discordFolderScript(target.platform),
				devicePathScript(path),
				folder
					? `mkdir -p "$path" && ${archiver.unpack(staged)}`
					: `mkdir -p "$(dirname "$path")" && cat '${staged}' > "$path"`,
				`${archiver.owner} && echo "UBD_RESULT=$path"`,
			].join('\n'),
			TRANSFER_TIMEOUT_MS,
		);

		if (!placed.ok) {
			return failure('tool-failed', `Placing ${path} on the device failed: ${placed.error}`);
		}

		const restarted = await restartIfAsked(target, options.restart);

		return {
			ok: true,
			text: `Pushed ${local} to ${placed.value}.${restarted}`,
			data: { local, path: placed.value },
		};
	} finally {
		if (scratch) {
			rmSync(scratch, { recursive: true, force: true });
		}

		await runScript(target, `rm -f '${staged}'\necho "UBD_RESULT=removed"`);
	}
}

export default { devicePathScript, pullFromDiscord, pushToDiscord };
