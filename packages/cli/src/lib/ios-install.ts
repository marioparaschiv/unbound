import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { delimiter, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

import type { InstallOptions, PluginPayload } from '~/lib/plugin-install';
import type { CommandResult } from '~/lib/run-command';
import { logToStderr } from '~/lib/plugin-install';
import { runCommand } from '~/lib/run-command';
import { createTarGz } from '~/lib/tar';

export const DISCORD_BUNDLE_ID = 'com.hammerandchisel.discord';

export const IOS_TIMEOUTS = {
	list: 30_000,
	transfer: 120_000,
	shell: 90_000,
	restart: 60_000,
};

const PILOT = 'jb-p1lot';
const STAGING_DIRECTORY = '/var/tmp';
const CONTAINERS_DIRECTORY = '/var/mobile/Containers/Data/Application';
const DEVICE_TAR = '/var/jb/usr/bin/tar';
const INSTALLED_MARKER = 'UBD_INSTALLED=';
const ERROR_MARKER = 'UBD_ERROR=';

export type IOSInstallOptions = InstallOptions & { udid?: string; pilot?: string };

type ShellResult = { ok: true; output: string } | { ok: false; error: string };

type PilotDevice = { id: string; bridge?: boolean };

/**
 * @description Finds the `jb-p1lot` binary on the PATH, falling back to Go's install directory.
 * @param env The environment to read `PATH` and `GOPATH` from.
 * @param home The home directory, for Go's default `~/go/bin`.
 * @returns The binary's path, or its bare name when it is nowhere to be found.
 */
export function resolvePilot(
	env: NodeJS.ProcessEnv = process.env,
	home: string = homedir(),
): string {
	const goBin = join(env.GOPATH?.split(delimiter)[0] || join(home, 'go'), 'bin');
	const directories = [...(env.PATH ?? '').split(delimiter).filter(Boolean), goBin];

	return directories.map((directory) => join(directory, PILOT)).find(existsSync) ?? PILOT;
}

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

	async function shell(command: string, timeoutMs: number): Promise<ShellResult> {
		return parseShellResult(
			await pilotCommand(['shell_exec', '--device', device, '--command', command], timeoutMs),
		);
	}

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

	const unpacked = await shell(unpackScript(plugin.id, staged), IOS_TIMEOUTS.shell);
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
		['ui_action', '--device', device, '--action', 'screen_on'],
		IOS_TIMEOUTS.restart,
	);

	const restarted = await shell(
		`killall -9 Discord; sleep 1; /var/jb/usr/bin/uiopen --bundleid ${DISCORD_BUNDLE_ID}`,
		IOS_TIMEOUTS.restart,
	);

	return restarted.ok
		? { ok: true, text: `Installed ${plugin.id} into ${destination} and restarted Discord.` }
		: {
				ok: false,
				text: `Installed ${plugin.id} into ${destination}, but restarting Discord failed: ${restarted.error}`,
			};
}

/**
 * @description Picks the one jailbroken iPhone whose jb-p1lot bridge is running.
 * @param pilotCommand Runs a jb-p1lot command.
 * @returns The device's UDID, or why no single device could be picked.
 */
export async function pickDevice(
	pilotCommand: (args: string[], timeoutMs: number) => Promise<CommandResult>,
): Promise<string | { error: string }> {
	const listed = await pilotCommand(['device_list'], IOS_TIMEOUTS.list);

	if (!listed.ok) {
		return { error: listed.error };
	}

	const devices = parseDevices(listed.stdout).filter((device) => device.bridge !== false);

	const [only] = devices;

	if (only && devices.length === 1) {
		return only.id;
	}

	return {
		error: devices.length
			? `Several iOS devices are connected (${devices.map((device) => device.id).join(', ')}); pass --udid to pick one.`
			: `${PILOT} lists no connected iOS device with its bridge running.`,
	};
}

function parseDevices(stdout: string): PilotDevice[] {
	try {
		const parsed = JSON.parse(stdout) as { devices?: PilotDevice[] };

		return (parsed.devices ?? []).filter((device) => typeof device.id === 'string');
	} catch {
		return [];
	}
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
export function unpackScript(id: string, archive: string): string {
	return [
		`archive='${archive}'`,
		`root=''`,
		`for plist in $(grep -l '${DISCORD_BUNDLE_ID}' ${CONTAINERS_DIRECTORY}/*/.com.apple.mobile_container_manager.metadata.plist 2>/dev/null); do`,
		`if [ -d "\${plist%/*}/Documents/Unbound" ]; then root="\${plist%/*}/Documents/Unbound"; break; fi`,
		'done',
		`if [ -z "$root" ]; then rm -f "$archive"; echo '${ERROR_MARKER}No Discord data container with an Unbound folder was found. Launch Discord with Unbound once, then retry.'; exit 1; fi`,
		`dest="$root/Plugins/${id}"`,
		`mkdir -p "$dest" && ${DEVICE_TAR} -xzf "$archive" --no-same-owner -C "$dest" && chown mobile:mobile "$root/Plugins" "$dest" "$dest"/* && chmod 644 "$dest"/*`,
		'status=$?',
		'rm -f "$archive"',
		`if [ $status -eq 0 ]; then echo "${INSTALLED_MARKER}$dest"; else echo '${ERROR_MARKER}Unpacking the plugin failed.'; fi`,
		'exit $status',
	].join('\n');
}

/**
 * @description Reads a `jb-p1lot shell_exec` result, whose JSON carries the command's exit code and output.
 * @param result The finished `jb-p1lot` call.
 * @returns The command's output when it exited cleanly, otherwise its output or exit code as the error.
 */
export function parseShellResult(result: CommandResult): ShellResult {
	if (!result.ok) {
		return result;
	}

	try {
		const parsed = JSON.parse(result.stdout) as { exitCode?: number; output?: string };
		const output = parsed.output ?? '';

		return parsed.exitCode === 0
			? { ok: true, output }
			: {
					ok: false,
					error:
						output.trim() || `The device command exited with code ${parsed.exitCode}.`,
				};
	} catch {
		return {
			ok: false,
			error: `${PILOT} answered with something other than JSON: ${result.stdout.trim()}`,
		};
	}
}

function readMarker(output: string, marker: string): string | undefined {
	return output
		.split('\n')
		.find((line) => line.startsWith(marker))
		?.slice(marker.length)
		.trim();
}

export default installOnIOS;
