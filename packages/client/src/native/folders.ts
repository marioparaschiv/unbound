import { unboundRelativePath } from '~/native/unbound-path';

/**
 * @description Says whether the loader can move a staged folder into place, so an install can be written whole first.
 * @returns Whether {@link replaceFolder} works on this loader.
 */
export function canReplaceFolders(): boolean {
	return typeof globalThis.NativePlatform?.files?.replace === 'function';
}

/**
 * @description Moves a fully written folder over another within the Unbound folder, the old one going back on failure.
 * @param staging The written folder, relative to the documents directory.
 * @param target The folder it replaces, relative to the documents directory.
 * @returns Whether the target now holds the staged folder.
 */
export function replaceFolder(staging: string, target: string): boolean {
	const from = unboundRelativePath(staging);
	const to = unboundRelativePath(target);

	return Boolean(from && to && globalThis.NativePlatform?.files?.replace?.(from, to));
}

export default { canReplaceFolders, replaceFolder };
