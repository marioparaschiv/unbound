import { getBytecodePath } from '@unbound-app/contracts/version-layout';
import { listAddonFiles } from '@unbound-app/contracts/addon-files';
import { MANIFEST_FILENAME } from '@unbound-app/contracts/manifest';
import { getBundleName } from '@unbound-app/contracts/workspace';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readBuiltAddon } from '~/lib/reload-transport';
import type { DiscoveredAddon } from '~/lib/discovery';
import type { CommandRunner } from '~/lib/run-command';

export type PluginFile = { name: string; path: string };

export type PluginPayload = { id: string; files: PluginFile[] };

export type InstallOptions = {
	restart: boolean;
	run?: CommandRunner;
	log?: (message: string) => void;
};

const SAFE_ADDON_ID = /^[\w.-]+$/;

/**
 * @description Lists the built files a plugin install copies onto a device: its manifest, bundle, Hermes bytecode and the
 * extra files the manifest lists. The manifest copied names each bytecode file's digest, which the loader checks before it
 * runs the bytecode instead of compiling the source.
 * @param addon The built plugin.
 * @returns The plugin's id and files, or why its id cannot be used as a folder name on the device.
 */
export function readPluginPayload(addon: DiscoveredAddon): PluginPayload | { error: string } {
	if (!SAFE_ADDON_ID.test(addon.id)) {
		return { error: `${addon.id} is not a valid plugin id for a device folder.` };
	}

	const { manifest, bytecode = {} } = readBuiltAddon(addon);
	const bundle = getBundleName(addon.static, manifest.main);
	const names = [
		bundle,
		...Object.keys(bytecode).map((version) => getBytecodePath(bundle, version)),
		...listAddonFiles(manifest).map((file) => file.path),
	];
	// The built manifest has no bytecode digests; the one read back adds them, so it is written out to copy instead.
	const staged = join(mkdtempSync(join(tmpdir(), 'ubd-install-')), MANIFEST_FILENAME);

	writeFileSync(staged, JSON.stringify(manifest, null, '\t'));

	return {
		id: addon.id,
		files: [
			{ name: MANIFEST_FILENAME, path: staged },
			...names.map((name) => ({ name, path: join(addon.output, name) })),
		],
	};
}

/**
 * @description Writes an install step's progress to stderr, which stays clear of the MCP's stdout.
 * @param message The line to write.
 */
export function logToStderr(message: string) {
	process.stderr.write(`${message}\n`);
}

export default readPluginPayload;
