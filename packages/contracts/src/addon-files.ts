import { ASSETS_DIRECTORY, getAssetPath, type AssetType } from './addon-assets.ts';
import { LOCALES_DIRECTORY, getLocalePath } from './addon-locales.ts';

/** What an extra file holds: an image, or a locale's JSON object of message keys to strings. */
export type AddonFileKind = 'asset' | 'locale';

/** A file an addon ships beside its bundle and lists in its manifest with its SHA-256. */
export type AddonFile = {
	kind: AddonFileKind;
	/** The file's path relative to the manifest. */
	path: string;
	/** The SHA-256 of the file's bytes, in hex. */
	sha256: string;
	/** What the file is, for messages: `asset icons/star@2x` or `locale de`. */
	label: string;
};

/** What an asset entry contributes to the file list: its type and its file's SHA-256 at each scale. */
export type ListedAsset = {
	type: AssetType;
	scales: Partial<Record<string, string>>;
};

/** The manifest fields that list extra files. */
export type AddonFileListing = {
	main: string;
	assets?: Record<string, ListedAsset>;
	/** The SHA-256 of each locale file, by locale code. */
	locales?: Record<string, string>;
};

/** The folders beside the bundle that hold extra files, which an install replaces whole. */
export const ADDON_FILE_DIRECTORIES = [ASSETS_DIRECTORY, LOCALES_DIRECTORY] as const;

/**
 * @description Lists every extra file a manifest names beside its bundle, once per path; publishing copies them and installing downloads them.
 * @returns The files, each with its SHA-256: the images, then the locales.
 */
export function listAddonFiles(manifest: AddonFileListing): AddonFile[] {
	const files = new Map<string, AddonFile>();

	for (const [name, asset] of Object.entries(manifest.assets ?? {})) {
		for (const [scale, sha256] of Object.entries(asset.scales)) {
			if (!sha256) {
				continue;
			}

			const path = getAssetPath(manifest.main, sha256, asset.type);
			const label = `asset ${name}${scale === '1' ? '' : `@${scale}x`}`;

			if (!files.has(path)) {
				files.set(path, { kind: 'asset', path, sha256, label });
			}
		}
	}

	for (const [code, sha256] of Object.entries(manifest.locales ?? {})) {
		const path = getLocalePath(manifest.main, code);

		files.set(path, { kind: 'locale', path, sha256, label: `locale ${code}` });
	}

	return [...files.values()];
}

export default { ADDON_FILE_DIRECTORIES, listAddonFiles };
