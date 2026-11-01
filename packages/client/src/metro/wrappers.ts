import { createLazyModule, getModulePresence, whenModuleLoads } from '~/metro/lazy-registry';
import { finder, type Finders, type TermOrOptions } from '~/metro/finders';

/**
 * @description Lazily finds a module by its properties. The metro search is deferred until the
 * returned object is first accessed, keeping this file a side-effect-free leaf.
 * @param args The property names the target module must expose, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access; a patch on it waits for the module to load.
 */
export function findByPropsLazy(...args: TermOrOptions[]) {
	return lazySearch('findByProps', args);
}

/**
 * @description Lazily finds a module by the name of its default export.
 * @param args The name(s) to match against, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access; a patch on it waits for the module to load.
 */
export function findByNameLazy(...args: TermOrOptions[]) {
	return lazySearch('findByName', args);
}

/**
 * @description Lazily finds a module by its file path.
 * @param args The file path segment(s) to match against, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access; a patch on it waits for the module to load.
 */
export function findByFilePathLazy(...args: TermOrOptions[]) {
	return lazySearch('findByFilePath', args);
}

/**
 * @description Lazily finds a module by methods present on its prototype.
 * @param args The prototype method name(s) the target must expose, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching module on first property access; a patch on it waits for the module to load.
 */
export function findByPrototypesLazy(...args: TermOrOptions[]) {
	return lazySearch('findByPrototypes', args);
}

/**
 * @description Lazily finds a flux store by name.
 * @param args The store name(s) to match against, optionally followed by an options bag.
 * @returns A lazy proxy that resolves to the matching store on first property access; a patch on it waits for the store to load.
 */
export function findStoreLazy(...args: TermOrOptions[]) {
	return lazySearch('findStore', args);
}

// The `{ lazy: true }` search is made on first use, since a handle may be declared before the search module loads.
function lazySearch(name: Exclude<keyof Finders, 'find'>, args: TermOrOptions[]): MetroExport {
	let search: MetroExport;

	function inner() {
		search ??= finder(name)(...withLazy(args));

		return search;
	}

	return createLazyModule(() => inner().module, {
		wait: (callback) => whenModuleLoads(inner(), callback),
		// A search that cannot wait is resolved, as a patch on it would be.
		presence: () => getModulePresence(inner()) ?? (inner().module ? 'loaded' : 'missing'),
	});
}

function withLazy(args: TermOrOptions[]): TermOrOptions[] {
	const last = args.at(-1);

	if (typeof last === 'object') {
		return [...args.slice(0, -1), { ...last, lazy: true }];
	}

	return [...args, { lazy: true }];
}

export default {
	findByPropsLazy,
	findByNameLazy,
	findByFilePathLazy,
	findByPrototypesLazy,
	findStoreLazy,
};
