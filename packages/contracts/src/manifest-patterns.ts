/**
 * Addon ids become object-storage path segments (`addons/{id}/{version}/...`), so they are limited to
 * path-safe characters: alphanumeric runs joined by single `.`, `_` or `-`.
 */
export const ADDON_ID_PATTERN = '^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$';

export const ADDON_ID_MAX_LENGTH = 100;

const ADDON_ID = new RegExp(ADDON_ID_PATTERN);

/**
 * @description Tells whether `value` is an addon id the store accepts.
 * @param value The untrusted value.
 * @returns Whether it is a path-safe id of at most {@link ADDON_ID_MAX_LENGTH} characters.
 */
// UNKNOWN: an id read from a link, a manifest or an installed addon's folder name.
export function isAddonId(value: unknown): value is string {
	return typeof value === 'string' && value.length <= ADDON_ID_MAX_LENGTH && ADDON_ID.test(value);
}

// The bundle is published next to the manifest at `addons/{id}/{version}/{main}` and resolved
// relative to the manifest URL, so `main` may not leave that directory.
export const ADDON_MAIN_PATTERN = /^(?:[\w-][\w.-]*\/)*[\w-][\w.-]*$/;

/**
 * @description Tells whether `value` is a bundle path inside an addon's folder.
 * @param value The untrusted value.
 * @returns Whether it is a relative path that cannot leave the addon.
 */
// UNKNOWN: a path read from a manifest or an installed addon.
export function isAddonMain(value: unknown): value is string {
	return typeof value === 'string' && ADDON_MAIN_PATTERN.test(value);
}

export default {
	ADDON_ID_PATTERN,
	ADDON_ID_MAX_LENGTH,
	isAddonId,
	ADDON_MAIN_PATTERN,
	isAddonMain,
};
