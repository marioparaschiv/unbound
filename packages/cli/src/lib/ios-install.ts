import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { DEVELOPMENT_MARKER } from '@unbound-app/contracts/manifest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DISCORD_BUNDLE_ID, IOS_CONTAINERS_DIRECTORY, IOS_TAR } from '~/lib/device-paths';
import type { InstallOptions, PluginPayload } from '~/lib/plugin-install';
import { ERROR_MARKER, readMarker } from '~/lib/pilot';
import type { CommandResult } from '~/lib/run-command';
import type { IOSTarget } from '~/lib/device-target';
import { failure } from '~/lib/command-error';
import { logToStderr } from '~/lib/stderr';
import { createTarGz } from '~/lib/tar';

const INSTALLED_MARKER = 'UBD_INSTALLED=';

/**
 * @description Copies a built plugin into Discord's plugin folder on a jailbroken iPhone through
 * `jb-p1lot`. The files travel as one archive staged on the device, since writes straight into an app
 * container fail, and are unpacked as root into the Unbound folder of whichever data container
 * belongs to Discord, so a reinstall that moves the container is followed.
 * @param plugin The plugin's id and built files.
 * @param target The device.
 * @param options Whether to restart Discord, and where progress goes.
 * @returns What was installed where, or the step that failed.
 */
export async function installOnIOS(
	plugin: PluginPayload,
	target: IOSTarget,
	options: InstallOptions,
): Promise<CommandOutput> {
	const { restart, log = logToStderr } = options;
	const archiveName = `ubd-${plugin.id}-${crypto.randomUUID()}.tar.gz`;
	const staged = `${target.staging}/${archiveName}`;

	log(`Copying ${plugin.id} to ${target.id}…`);

	const transferred = await transferArchive(plugin, archiveName, (source) =>
		target.push(source, staged),
	);

	if (!transferred.ok) {
		return failure('tool-failed', transferred.error);
	}

	const unpacked = await target.shell(unpackScript(plugin.id, staged));
	const output = unpacked.ok ? unpacked.output : unpacked.error;
	const destination = unpacked.ok ? readMarker(output, INSTALLED_MARKER) : void 0;

	if (!destination) {
		const reason = readMarker(output, ERROR_MARKER) ?? output.trim();

		return failure('tool-failed', `Installing ${plugin.id} on ${target.id} failed: ${reason}`);
	}

	if (!restart) {
		return {
			ok: true,
			text: `Installed ${plugin.id} into ${destination}. Restart Discord to load it.`,
		};
	}

	log('Restarting Discord…');

	const restarted = await target.restartDiscord();

	return restarted.ok
		? { ok: true, text: `Installed ${plugin.id} into ${destination} and restarted Discord.` }
		: failure(
				'tool-failed',
				`Installed ${plugin.id} into ${destination}, but restarting Discord failed: ${restarted.error}`,
			);
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
		`mkdir -p "$dest" && ${IOS_TAR} -xzf "$archive" --no-same-owner -C "$dest" && touch "$dest/${DEVELOPMENT_MARKER}" && chown mobile:mobile "$root/Plugins" && chown -R mobile:mobile "$dest" && chmod -R u=rwX,go=rX "$dest"`,
		'status=$?',
		'rm -f "$archive"',
		`if [ $status -eq 0 ]; then echo "${INSTALLED_MARKER}$dest"; else echo '${ERROR_MARKER}Unpacking the plugin failed.'; fi`,
		'exit $status',
	].join('\n');
}

export default installOnIOS;
