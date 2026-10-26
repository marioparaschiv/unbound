import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';

import type { InstallOptions, PluginPayload } from '~/lib/plugin-install';
import { formatDuration, runCommand } from '~/lib/run-command';
import type { CommandResult } from '~/lib/run-command';
import { logToStderr } from '~/lib/plugin-install';

export const ANDROID_PLUGINS_DIRECTORY = '/data/data/com.discord/files/Unbound/Plugins';

export const ANDROID_TIMEOUTS = {
	state: 15_000,
	push: 120_000,
	shell: 60_000,
	restart: 30_000,
};

const STAGING_DIRECTORY = '/data/local/tmp';
const DISCORD_PACKAGE = 'com.discord';

export type AndroidInstallOptions = InstallOptions & { serial?: string };

/**
 * @description Copies a built plugin into Discord's plugin folder on a rooted Android device over adb,
 * staging each file in `/data/local/tmp` and copying it into place as root. Every adb call is bounded
 * by a timeout, so an offline device or an unanswered root prompt fails instead of hanging.
 * @param plugin The plugin's id and built files.
 * @param options The device serial, whether to restart Discord, and the command runner to use.
 * @returns What was installed where, or the step that failed.
 */
export async function installOnAndroid(
	plugin: PluginPayload,
	options: AndroidInstallOptions,
): Promise<CommandOutput> {
	const { serial, restart, run = runCommand, log = logToStderr } = options;
	const target = serial ?? 'the attached device';

	function adb(args: string[], timeoutMs: number): Promise<CommandResult> {
		return run('adb', [...(serial ? ['-s', serial] : []), ...args], timeoutMs);
	}

	const state = await adb(['get-state'], ANDROID_TIMEOUTS.state);

	if (!state.ok) {
		return { ok: false, text: `No Android device is ready over adb. ${state.error}` };
	}

	log(`Copying ${plugin.id} to ${target}…`);

	for (const file of plugin.files) {
		const pushed = await adb(
			['push', file.path, stagingPath(plugin, file.name)],
			ANDROID_TIMEOUTS.push,
		);

		if (!pushed.ok) {
			return { ok: false, text: pushed.error };
		}
	}

	const identity = await adb(['shell', 'id -u'], ANDROID_TIMEOUTS.shell);

	if (!identity.ok) {
		return { ok: false, text: identity.error };
	}

	const destination = `${ANDROID_PLUGINS_DIRECTORY}/${plugin.id}`;
	const script = copyIntoPlaceScript(plugin, destination);
	const asRoot = identity.stdout.trim() === '0';
	const moved = await adb(
		['shell', asRoot ? script : `su -c '${script}'`],
		ANDROID_TIMEOUTS.shell,
	);

	if (!moved.ok) {
		return {
			ok: false,
			text: asRoot
				? moved.error
				: `${moved.error} Root is needed to write into Discord's data; grant the shell root in your root manager if it asked, then retry within ${formatDuration(ANDROID_TIMEOUTS.shell)}.`,
		};
	}

	if (!restart) {
		return {
			ok: true,
			text: `Installed ${plugin.id} into ${destination}. Restart Discord to load it.`,
		};
	}

	log('Restarting Discord…');

	const restarted = await adb(
		[
			'shell',
			`am force-stop ${DISCORD_PACKAGE} && monkey -p ${DISCORD_PACKAGE} -c android.intent.category.LAUNCHER 1`,
		],
		ANDROID_TIMEOUTS.restart,
	);

	return restarted.ok
		? { ok: true, text: `Installed ${plugin.id} into ${destination} and restarted Discord.` }
		: {
				ok: false,
				text: `Installed ${plugin.id} into ${destination}, but restarting Discord failed: ${restarted.error}`,
			};
}

function stagingPath(plugin: PluginPayload, name: string): string {
	return `${STAGING_DIRECTORY}/${plugin.id}-${name}`;
}

function copyIntoPlaceScript(plugin: PluginPayload, destination: string): string {
	const staged = plugin.files.map((file) => stagingPath(plugin, file.name));
	const copies = plugin.files
		.map((file, index) => `cp ${staged[index]} ${destination}/${file.name}`)
		.join(' && ');

	return `mkdir -p ${destination} && ${copies} && chown -R $(stat -c %u:%g ${ANDROID_PLUGINS_DIRECTORY}) ${destination} && chmod 600 ${destination}/* && rm -f ${staged.join(' ')}`;
}

export default installOnAndroid;
