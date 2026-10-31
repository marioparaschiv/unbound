import { addonManifestSchema, type PublishedManifest } from '@unbound-app/contracts/manifest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ICON_PATTERN = /^[A-Za-z0-9_-]+$/;

export type PluginManifestEntry = {
	folder: string;
	manifest: PublishedManifest;
};

/**
 * @description Reads and validates one plugin manifest, throwing with the file's path when it is not a valid addon manifest.
 * @param path The manifest.json path.
 * @returns The parsed manifest.
 */
export function readPluginManifest(path: string): PublishedManifest {
	const result = addonManifestSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));

	if (!result.success) {
		throw new Error(`${path} is not a valid addon manifest: ${result.error.message}`);
	}

	return result.data;
}

/**
 * @description Reads every plugin folder's manifest, in directory order, skipping folders without a manifest.json.
 * @param directory The plugins workspace folder.
 * @returns Each plugin's folder name and parsed manifest.
 */
export function readPluginManifests(directory: string): PluginManifestEntry[] {
	return readdirSync(directory, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isDirectory() && existsSync(join(directory, entry.name, 'manifest.json')),
		)
		.map((entry) => ({
			folder: entry.name,
			manifest: readPluginManifest(join(directory, entry.name, 'manifest.json')),
		}));
}

/**
 * @description Returns a plugin's icon name, which must name a bundled Discord icon.
 * @param manifest The plugin's manifest.
 * @returns The icon name.
 */
export function pluginIcon(manifest: PublishedManifest): string {
	const { icon } = manifest;

	if (!icon) {
		throw new Error(`Plugin ${manifest.id} is missing a manifest icon.`);
	}

	if (typeof icon !== 'string') {
		throw new Error(`Plugin ${manifest.id} has an icon URI instead of an icon name.`);
	}

	if (!ICON_PATTERN.test(icon)) {
		throw new Error(`Plugin ${manifest.id} has an invalid icon name: ${icon}.`);
	}

	return icon;
}

export default { readPluginManifest, readPluginManifests, pluginIcon };
