import { MANIFEST_FILENAME } from '@unbound-app/contracts/manifest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bytecodeFileName } from '~/rollup/hermes-bytecode';
import { listBuiltFiles } from '~/lib/built-addon';
import type { DiscoveredAddon } from '~/lib/discovery';

export type PluginFile = { name: string; path: string };

export type PluginPayload = { id: string; files: PluginFile[] };

export type InstallOptions = {
	restart: boolean;
	log?: (message: string) => void;
};

const SAFE_ADDON_ID = /^[\w.-]+$/;

/**
 * @description Lists the built files a plugin install copies onto a device: its manifest, bundle, this build's Hermes
 * bytecode and the extra files the manifest lists. The manifest copied names each bytecode file's digest, which the
 * loader checks before it runs the bytecode instead of compiling the source; it is written into `staging`.
 * @param addon The built plugin.
 * @param staging A directory the caller owns and removes once the install is done.
 * @returns The plugin's id and files, or why its id cannot be used as a folder name on the device.
 */
export function readPluginPayload(
	addon: DiscoveredAddon,
	staging: string,
): PluginPayload | { error: string } {
	if (!SAFE_ADDON_ID.test(addon.id)) {
		return { error: `${addon.id} is not a valid plugin id for a device folder.` };
	}

	const built = listBuiltFiles(addon);
	const versions = Object.keys(built.bytecode);
	const manifest = versions.length
		? { ...built.manifest, bytecode: built.bytecode }
		: built.manifest;
	const names = [
		built.bundle,
		...versions.map((version) => bytecodeFileName(built.bundle, Number(version))),
		...built.files,
	];
	// The built manifest has no bytecode digests, so the one naming them is written out to copy instead.
	const staged = join(staging, MANIFEST_FILENAME);

	writeFileSync(staged, JSON.stringify(manifest, null, '\t'));

	return {
		id: addon.id,
		files: [
			{ name: MANIFEST_FILENAME, path: staged },
			...names.map((name) => ({ name, path: join(addon.output, name) })),
		],
	};
}

export default readPluginPayload;
