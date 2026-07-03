import lazy from '@unbound-app/utils/lazy';

/** A search term, or a trailing search-options bag accepted by the `findBy*` family. */
type TermOrOptions = string | Record<string, any>;

/**
 * @description Lazily finds a module by its properties. The metro search is deferred until the
 * returned object is first accessed, keeping this file a side-effect-free leaf.
 * @param args The property names the target module must expose, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access.
 */
export function findByPropsLazy(...args: TermOrOptions[]) {
	return lazy(() => require('~/api/metro').findByProps(...args));
}

/**
 * @description Lazily finds a module by the name of its default export.
 * @param args The name(s) to match against, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access.
 */
export function findByNameLazy(...args: TermOrOptions[]) {
	return lazy(() => require('~/api/metro').findByName(...args));
}

/**
 * @description Lazily finds a module by its file path.
 * @param args The file path segment(s) to match against, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access.
 */
export function findByFilePathLazy(...args: TermOrOptions[]) {
	return lazy(() => require('~/api/metro').findByFilePath(...args));
}

/**
 * @description Lazily finds a module by methods present on its prototype.
 * @param args The prototype method name(s) the target must expose, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access.
 */
export function findByPrototypesLazy(...args: TermOrOptions[]) {
	return lazy(() => require('~/api/metro').findByPrototypes(...args));
}

/**
 * @description Lazily finds a flux store by name.
 * @param args The store name(s) to match against, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching store on first property access.
 */
export function findStoreLazy(...args: TermOrOptions[]) {
	return lazy(() => require('~/api/metro').findStore(...args));
}

export default {
	findByPropsLazy,
	findByNameLazy,
	findByFilePathLazy,
	findByPrototypesLazy,
	findStoreLazy,
};
