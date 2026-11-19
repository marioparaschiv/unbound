import {
	ADDON_FILE_DIRECTORIES,
	listAddonFiles,
	type AddonFile,
} from '@unbound-app/contracts/addon-files';
import type { createLogger } from '@unbound-app/logger';
import type { AddonManifest } from '@unbound-app/types';
import sha256 from '@unbound-app/utils/sha256';

import fs from '~/native/fs';

/** The extra files of an addon, base64-encoded, by path relative to its manifest. */
export type AddonFiles = Record<string, string>;

type Logger = ReturnType<typeof createLogger>;

async function downloadFile(url: string, file: AddonFile): Promise<string> {
	const res = await fetch(url, { cache: 'no-cache' });

	if (!res.ok) {
		throw new Error(`status ${res.status}`);
	}

	const bytes = new Uint8Array(await res.arrayBuffer());

	if (sha256(bytes) !== file.sha256) {
		throw new Error('its SHA-256 does not match the manifest');
	}

	return Buffer.from(bytes).toString('base64');
}

async function installedCopy(
	directory: string | undefined,
	file: AddonFile,
): Promise<string | undefined> {
	const path = `${directory}/${file.path}`;

	if (!directory || !(await fs.exists(path))) {
		return undefined;
	}

	const contents = await fs.readFile(path, 'base64');

	return sha256(Buffer.from(contents, 'base64')) === file.sha256 ? contents : undefined;
}

async function fetchFile(url: string, file: AddonFile, directory?: string): Promise<string> {
	const installed = await installedCopy(directory, file).catch(() => undefined);

	return installed ?? downloadFile(url, file);
}

/**
 * @description Fetches every extra file the manifest lists, in parallel, from beside the bundle, reusing the
 * installed copy of each file whose SHA-256 still matches, so an update downloads only the files it changed.
 * A file that fails is logged and left out, so the addon still installs without it.
 * @param manifest The addon's manifest.
 * @param bundleUrl The bundle's URL; each file's path is relative to the folder holding the manifest.
 * @param logger The manager's logger.
 * @param directory The installed addon's folder, relative to the documents directory, when it has one.
 * @returns The files, by path.
 */
export async function downloadAddonFiles(
	manifest: AddonManifest,
	bundleUrl: string,
	logger: Logger,
	directory?: string,
): Promise<AddonFiles> {
	const listed = listAddonFiles(manifest);
	const base = bundleUrl.slice(0, bundleUrl.length - manifest.main.length);
	const results = await Promise.allSettled(
		listed.map((file) => fetchFile(`${base}${file.path}`, file, directory)),
	);
	const files: AddonFiles = {};

	for (const [index, result] of results.entries()) {
		const file = listed[index];

		if (result.status === 'fulfilled') {
			files[file.path] = result.value;
		} else {
			logger.error(`Failed to download ${file.label} for ${manifest.id}:`, result.reason);
		}
	}

	return files;
}

/**
 * @description Replaces an addon's extra files with the given ones in its folder, removing the ones the
 * previous version shipped, so a dropped image or locale does not stay on disk. Only listed paths are written.
 * @param directory The addon's folder, relative to the documents directory.
 * @param manifest The addon's manifest, whose `main` places the files.
 * @param files The files, base64-encoded, by path.
 */
export async function writeAddonFiles(
	directory: string,
	manifest: AddonManifest,
	files: AddonFiles,
): Promise<void> {
	const base = `${directory}/${manifest.main.slice(0, manifest.main.lastIndexOf('/') + 1)}`;

	await Promise.all(
		ADDON_FILE_DIRECTORIES.map(async (name) => {
			if (await fs.exists(`${base}${name}`)) {
				await fs.removeFile(`${base}${name}`);
			}
		}),
	);

	const paths = listAddonFiles(manifest)
		.map(({ path }) => path)
		.filter((path) => Object.hasOwn(files, path));
	// The native write creates a missing parent folder and fails when a parallel write created it first, so
	// each folder's first file is written alone.
	const firsts = new Map<string, string>();

	for (const path of paths) {
		const folder = path.slice(0, path.lastIndexOf('/') + 1);

		if (!firsts.has(folder)) {
			firsts.set(folder, path);
		}
	}

	const write = (path: string) => fs.writeFile(`${directory}/${path}`, files[path], 'base64');
	const leading = new Set(firsts.values());

	for (const path of leading) {
		await write(path);
	}

	await Promise.all(paths.filter((path) => !leading.has(path)).map(write));
}
