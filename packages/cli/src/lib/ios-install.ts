import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { DEVELOPMENT_MARKER } from '@unbound-app/contracts/manifest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	ERROR_MARKER,
	IOS_TIMEOUTS,
	pickDevice,
	pilotShell,
	readMarker,
	resolvePilot,
} from '~/lib/pilot';
import {
	DISCORD_BUNDLE_ID,
	IOS_CONTAINERS_DIRECTORY,
	IOS_TAR,
	IOS_UIOPEN,
} from '~/lib/device-paths';
import type { InstallOptions, PluginPayload } from '~/lib/plugin-install';
import type { CommandResult } from '~/lib/run-command';
import { logToStderr } from '~/lib/plugin-install';
import { runCommand } from '~/lib/run-command';
import { createTarGz } from '~/lib/tar';

const STAGING_DIRECTORY = '/var/tmp';
const INSTALLED_MARKER = 'UBD_INSTALLED=';

export type IOSInstallOptions = InstallOptions & { udid?: string; pilot?: string };

/**
 * @description Copies a built plugin into Discord's plugin folder on a jailbroken iPhone through
 * `jb-p1lot`. The files travel as one archive staged in `/var/tmp`, since writes straight into an app
 * container fail, and are unpacked as root into the Unbound folder of whichever data container
 * belongs to Discord, so a reinstall that moves the container is followed.
 * @param plugin The plugin's id and built files.
 * @param options The device UDID, whether to restart Discord, and the runner and binary to use.
 * @returns What was installed where, or the step that failed.
 */
export async function installOnIOS(
	plugin: PluginPayload,
	options: IOSInstallOptions,
): Promise<CommandOutput> {
	const { restart, run = runCommand, log = logToStderr, pilot = resolvePilot() } = options;

	function pilotCommand(args: string[], timeoutMs: number): Promise<CommandResult> {
		return run(pilot, args, timeoutMs);
	}

	const picked = options.udid ?? (await pickDevice(pilotCommand));

	if (typeof picked !== 'string') {
		return { ok: false, text: picked.error };
	}

	const device = picked;
	const target = { udid: device, pilot, run };

	const archiveName = `ubd-${plugin.id}-${crypto.randomUUID()}.tar.gz`;
	const staged = `${STAGING_DIRECTORY}/${archiveName}`;

	log(`Copying ${plugin.id} to ${device}…`);

	const transferred = await transferArchive(plugin, archiveName, (source) =>
		pilotCommand(
			[
				'file_transfer',
				'--device',
				device,
				'--direction',
				'host_to_device',
				'--source',
				source,
				'--destination',
				staged,
			],
			IOS_TIMEOUTS.transfer,
		),
	);

	if (!transferred.ok) {
		return { ok: false, text: transferred.error };
	}

	const unpacked = await pilotShell(target, unpackScript(plugin.id, staged));
	const output = unpacked.ok ? unpacked.output : unpacked.error;
	const destination = unpacked.ok ? readMarker(output, INSTALLED_MARKER) : void 0;

	if (!destination) {
		const reason = readMarker(output, ERROR_MARKER) ?? output.trim();

		return { ok: false, text: `Installing ${plugin.id} on ${device} failed: ${reason}` };
	}

	if (!restart) {
		return {
			ok: true,
			text: `Installed ${plugin.id} into ${destination}. Restart Discord to load it.`,
		};
	}

	log('Restarting Discord…');

	await pilotCommand(
		['ui_action', '--device', device, '--action', 'button', '--button', 'unlock'],
		IOS_TIMEOUTS.restart,
	);

	const restarted = await pilotShell(
		target,
		`killall -9 Discord; sleep 1; ${IOS_UIOPEN} --bundleid ${DISCORD_BUNDLE_ID}`,
		{ timeoutMs: IOS_TIMEOUTS.restart },
	);

	return restarted.ok
		? { ok: true, text: `Installed ${plugin.id} into ${destination} and restarted Discord.` }
		: {
				ok: false,
				text: `Installed ${plugin.id} into ${destination}, but restarting Discord failed: ${restarted.error}`,
			};
}

async function transferArchive(
	plugin: PluginPayload,
	archiveName: string,
	transfer: (source: string) => Promise<CommandResult>,
): Promise<CommandResult> {
	const directory = mkdtempSync(join(tmpdir(), 'ubd-install-'));
	const source = join(directory, archiveName);

	try {
		writeFileSync(
			source,
			createTarGz(
				plugin.files.map((file) => ({ name: file.name, data: readFileSync(file.path) })),
			),
		);

		const first = await transfer(source);

		return first.ok ? first : await transfer(source);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

/**
 * @description Builds the device script that finds Discord's Unbound folder, unpacks a staged plugin
 * archive into its plugin folder, and hands the files to the `mobile` user.
 * @param id The plugin's id, which names its folder.
 * @param archive The staged archive's path on the device.
 * @returns The shell script, which prints the destination on success and the reason on failure.
 */
function unpackScript(id: string, archive: string): string {
	return [
		`archive='${archive}'`,
		`root=''`,
		`for plist in $(grep -l '${DISCORD_BUNDLE_ID}' ${IOS_CONTAINERS_DIRECTORY}/*/.com.apple.mobile_container_manager.metadata.plist 2>/dev/null); do`,
		`if [ -d "\${plist%/*}/Documents/Unbound" ]; then root="\${plist%/*}/Documents/Unbound"; break; fi`,
		'done',
		`if [ -z "$root" ]; then rm -f "$archive"; echo '${ERROR_MARKER}No Discord data container with an Unbound folder was found. Launch Discord with Unbound once, then retry.'; exit 1; fi`,
		`dest="$root/Plugins/${id}"`,
		`mkdir -p "$dest" && ${IOS_TAR} -xzf "$archive" --no-same-owner -C "$dest" && touch "$dest/${DEVELOPMENT_MARKER}" && chown mobile:mobile "$root/Plugins" "$dest" "$dest"/* && chmod 644 "$dest"/*`,
		'status=$?',
		'rm -f "$archive"',
		`if [ $status -eq 0 ]; then echo "${INSTALLED_MARKER}$dest"; else echo '${ERROR_MARKER}Unpacking the plugin failed.'; fi`,
		'exit $status',
	].join('\n');
}

export default installOnIOS;
