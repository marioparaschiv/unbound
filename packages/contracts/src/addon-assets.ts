/** The folder, at the plugin root and beside the built bundle, that holds a plugin's images. */
export const ASSETS_DIRECTORY = 'assets';

/** The image types a plugin ships: the formats React Native's `Image` decodes. An SVG is a component, not an asset. */
export const ASSET_TYPES = ['png', 'jpg', 'webp', 'gif'] as const;

/** One of {@link ASSET_TYPES}. */
export type AssetType = (typeof ASSET_TYPES)[number];

/** The pixel densities a plugin image can ship at, as its `@2x` and `@3x` file suffixes name them. */
export const ASSET_SCALES = ['1', '2', '3'] as const;

/** Path segments joined by `/`, each starting with a letter, digit, `_` or `-`, so no name can leave its folder. */
export const ASSET_NAME_PATTERN = '^[\\w-][\\w.-]*(?:/[\\w-][\\w.-]*)*$';

const ASSET_NAME = new RegExp(ASSET_NAME_PATTERN);

/**
 * @description Tells whether `value` can name a plugin asset: path segments without `..`, at most 200 characters.
 * @param value The untrusted value.
 * @returns Whether it is a safe asset name.
 */
// UNKNOWN: a name read from a manifest or a file path.
export function isAssetName(value: unknown): value is string {
	return typeof value === 'string' && value.length <= 200 && ASSET_NAME.test(value);
}

/**
 * @description Tells whether `value` is one of {@link ASSET_TYPES}.
 * @param value The untrusted value.
 * @returns Whether a plugin can ship an image of this type.
 */
// UNKNOWN: a type read from a manifest or a file extension.
export function isAssetType(value: unknown): value is AssetType {
	return ASSET_TYPES.some((type) => type === value);
}

/**
 * @description Names an image file beside an addon's bundle. Files are named by content, so equal images share one.
 * @param main The manifest's `main`, such as `index.js`.
 * @param sha256 The file's SHA-256.
 * @param type The file's type.
 * @returns The file's path relative to the manifest, such as `assets/<sha256>.png`.
 */
export function getAssetPath(main: string, sha256: string, type: AssetType): string {
	return `${main.slice(0, main.lastIndexOf('/') + 1)}${ASSETS_DIRECTORY}/${sha256}.${type}`;
}

export default {
	ASSETS_DIRECTORY,
	ASSET_TYPES,
	ASSET_SCALES,
	ASSET_NAME_PATTERN,
	isAssetName,
	isAssetType,
	getAssetPath,
};
