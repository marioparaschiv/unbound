import { getBundleName } from '@unbound-app/contracts/workspace';
import { join } from 'node:path';

import { readBuiltAddon } from '~/lib/reload-transport';
import type { DiscoveredAddon } from '~/lib/discovery';
import type { CommandRunner } from '~/lib/run-command';

export type PluginFile = { name: string; path: string };

/** The file `ubd install` leaves in a plugin's folder so the client treats it as a development copy. */
export const DEVELOPMENT_MARKER = 'development';

export type PluginPayload = { id: string; files: PluginFile[] };

export type InstallOptions = {
	restart: boolean;
	run?: CommandRunner;
	log?: (message: string) => void;
};

const SAFE_ADDON_ID = /^[\w.-]+$/;

/**
 * @description Lists the built files a plugin install copies onto a device: its manifest and bundle.
 * @param addon The built plugin.
 * @returns The plugin's id and files, or why its id cannot be used as a folder name on the device.
 */
export function readPluginPayload(addon: DiscoveredAddon): PluginPayload | { error: string } {
	if (!SAFE_ADDON_ID.test(addon.id)) {
		return { error: `${addon.id} is not a valid plugin id for a device folder.` };
	}

	const { manifest } = readBuiltAddon(addon);
	const names = ['manifest.json', getBundleName(addon.static, manifest.main)];

	return { id: addon.id, files: names.map((name) => ({ name, path: join(addon.output, name) })) };
}

/**
 * @description Writes an install step's progress to stderr, which stays clear of the MCP's stdout.
 * @param message The line to write.
 */
export function logToStderr(message: string) {
	process.stderr.write(`${message}\n`);
}

export default readPluginPayload;
