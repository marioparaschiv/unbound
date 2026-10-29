import { findLazy, type TermOrOptions } from '~/api/metro/finders';

/**
 * @description Lazily finds a module by its properties. The metro search is deferred until the
 * returned object is first accessed, keeping this file a side-effect-free leaf.
 * @param args The property names the target module must expose, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access; a patch on it waits for the module to load.
 */
export function findByPropsLazy(...args: TermOrOptions[]) {
	return findLazy('findByProps', args);
}

/**
 * @description Lazily finds a module by the name of its default export.
 * @param args The name(s) to match against, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access; a patch on it waits for the module to load.
 */
export function findByNameLazy(...args: TermOrOptions[]) {
	return findLazy('findByName', args);
}

/**
 * @description Lazily finds a module by its file path.
 * @param args The file path segment(s) to match against, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access; a patch on it waits for the module to load.
 */
export function findByFilePathLazy(...args: TermOrOptions[]) {
	return findLazy('findByFilePath', args);
}

/**
 * @description Lazily finds a module by methods present on its prototype.
 * @param args The prototype method name(s) the target must expose, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access; a patch on it waits for the module to load.
 */
export function findByPrototypesLazy(...args: TermOrOptions[]) {
	return findLazy('findByPrototypes', args);
}

/**
 * @description Lazily finds a flux store by name.
 * @param args The store name(s) to match against, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching store on first property access; a patch on it waits for the store to load.
 */
export function findStoreLazy(...args: TermOrOptions[]) {
	return findLazy('findStore', args);
}

export default {
	findByPropsLazy,
	findByNameLazy,
	findByFilePathLazy,
	findByPrototypesLazy,
	findStoreLazy,
};
