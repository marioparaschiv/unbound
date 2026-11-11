import { isAddonId, isAddonMain } from '@unbound-app/contracts/manifest-patterns';

const GITHUB_TREE_URL = /^https:\/\/(?:www\.)?github\.com\/[^/\s]+\/[^/\s]+(?:\/|$)/;

/**
 * @description Checks an icon pack's `main`: empty for the built-in pack, a GitHub tree URL the pack is downloaded from, or a relative path inside the pack.
 * @param main The `main` from an icon pack manifest.
 * @returns Whether an icon pack may use it.
 */
export function isSafeIconPackMain(main: unknown): main is string {
	if (main === '') {
		return true;
	}

	if (typeof main === 'string' && GITHUB_TREE_URL.test(main)) {
		return !main.split('/').some((segment) => segment === '..' || segment === '.');
	}

	return isSafeAddonMain(main);
}

/**
 * @description Checks that an addon id can name its folder: alphanumeric segments joined by ".", "_" or "-".
 * @param id The id from a manifest.
 * @returns Whether the id is safe to use as a folder name.
 */
export function isSafeAddonId(id: unknown): id is string {
	return isAddonId(id);
}

/**
 * @description Checks that a manifest's `main` stays inside the addon's folder.
 * @param main The `main` from a manifest.
 * @returns Whether `main` is a relative path inside the addon.
 */
export function isSafeAddonMain(main: unknown): main is string {
	return isAddonMain(main);
}

/**
 * @description Reads a path from a remote listing as a path inside a folder, rejecting anything that could leave it.
 * @param path The path from the listing.
 * @returns The path when every segment is a plain name, otherwise `undefined`.
 */
export function safeRelativePath(path: string): string | undefined {
	const segments = path.split('/');

	if (
		!path ||
		path.startsWith('/') ||
		path.includes('\\') ||
		path.includes('\0') ||
		segments.some((segment) => segment === '' || segment === '.' || segment === '..')
	) {
		return undefined;
	}

	return path;
}
