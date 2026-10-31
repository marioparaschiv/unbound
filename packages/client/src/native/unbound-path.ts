const UNBOUND_DIRECTORY = 'Unbound/';

/**
 * @description Reads a documents-relative path as a path inside the Unbound folder, the only place the loader removes files from.
 * @param path The path relative to the documents directory.
 * @returns The path relative to the Unbound folder, or `null` when it lies outside it or names the folder itself.
 */
export function unboundRelativePath(path: string): string | null {
	if (!path.startsWith(UNBOUND_DIRECTORY)) return null;

	return path.slice(UNBOUND_DIRECTORY.length) || null;
}
