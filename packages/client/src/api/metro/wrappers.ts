import lazy from '@unbound-app/utils/lazy';

/**
 * @description Lazily finds a module by its properties. The metro search is deferred until the
 * returned object is first accessed, keeping this file a side-effect-free leaf.
 * @param props The property names the target module must expose.
 * @returns A lazy proxy that resolves to the matching module on first property access.
 */
export function findByPropsLazy(...props: string[]) {
	return lazy(() => require('~/api/metro').findByProps(...props));
}

/**
 * @description Lazily finds a module by the name of its default export.
 * @param names The name(s) to match against.
 * @returns A lazy proxy that resolves to the matching module on first property access.
 */
export function findByNameLazy(...names: string[]) {
	return lazy(() => require('~/api/metro').findByName(...names));
}

/**
 * @description Lazily finds a module by its file path.
 * @param paths The file path segment(s) to match against.
 * @returns A lazy proxy that resolves to the matching module on first property access.
 */
export function findByFilePathLazy(...paths: string[]) {
	return lazy(() => require('~/api/metro').findByFilePath(...paths));
}

/**
 * @description Lazily finds a module by methods present on its prototype.
 * @param prototypes The prototype method name(s) the target must expose.
 * @returns A lazy proxy that resolves to the matching module on first property access.
 */
export function findByPrototypesLazy(...prototypes: string[]) {
	return lazy(() => require('~/api/metro').findByPrototypes(...prototypes));
}

/**
 * @description Lazily finds a flux store by name.
 * @param names The store name(s) to match against.
 * @returns A lazy proxy that resolves to the matching store on first property access.
 */
export function findStoreLazy(...names: string[]) {
	return lazy(() => require('~/api/metro').findStore(...names));
}

export default {
	findByPropsLazy,
	findByNameLazy,
	findByFilePathLazy,
	findByPrototypesLazy,
	findStoreLazy,
};
