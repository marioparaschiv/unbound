import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import { DEVELOPMENT_MARKER } from '@unbound-app/contracts/manifest';

import type { InstallOptions, PluginPayload } from '~/lib/plugin-install';
import { ANDROID_FILES_DIRECTORY } from '~/lib/device-paths';
import type { AndroidTarget } from '~/lib/device-target';
import { failure } from '~/lib/command-error';
import { logToStderr } from '~/lib/stderr';

export const ANDROID_PLUGINS_DIRECTORY = `${ANDROID_FILES_DIRECTORY}/Unbound/Plugins`;

/**
 * @description Copies a built plugin into Discord's plugin folder on a rooted Android device over adb,
 * staging each file on the device and copying it into place as root.
 * @param plugin The plugin's id and built files.
 * @param target The device.
 * @param options Whether to restart Discord, and where progress goes.
 * @returns What was installed where, or the step that failed.
 */
export async function installOnAndroid(
	plugin: PluginPayload,
	target: AndroidTarget,
	options: InstallOptions,
): Promise<CommandOutput> {
	const { restart, log = logToStderr } = options;

	log(`Copying ${plugin.id} to ${target.id}…`);

	for (const file of plugin.files) {
		const pushed = await target.push(file.path, stagingPath(target, plugin, file.name));

		if (!pushed.ok) {
			return failure('tool-failed', pushed.error);
		}
	}

	const destination = `${ANDROID_PLUGINS_DIRECTORY}/${plugin.id}`;
	const moved = await target.shell(copyIntoPlaceScript(target, plugin, destination));

	if (!moved.ok) {
		return failure('tool-failed', moved.error);
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

function stagingPath(target: AndroidTarget, plugin: PluginPayload, name: string): string {
	return `${target.staging}/${plugin.id}-${name.replaceAll('/', '_')}`;
}

function parentDirectories(plugin: PluginPayload, destination: string): string[] {
	const nested = plugin.files
		.filter((file) => file.name.includes('/'))
		.map((file) => `${destination}/${file.name.slice(0, file.name.lastIndexOf('/'))}`);

	return [destination, ...new Set(nested)];
}

function copyIntoPlaceScript(
	target: AndroidTarget,
	plugin: PluginPayload,
	destination: string,
): string {
	const staged = plugin.files.map((file) => stagingPath(target, plugin, file.name));
	const copies = plugin.files
		.map((file, index) => `cp ${staged[index]} ${destination}/${file.name}`)
		.join(' && ');

	return `mkdir -p ${parentDirectories(plugin, destination).join(' ')} && ${copies} && touch ${destination}/${DEVELOPMENT_MARKER} && chown -R $(stat -c %u:%g ${ANDROID_PLUGINS_DIRECTORY}) ${destination} && chmod -R u=rwX,go= ${destination} && rm -f ${staged.join(' ')}`;
}

export default installOnAndroid;
