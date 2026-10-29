import noop from '@unbound-app/utils/noop';

import { createLazyModule, getLazyModule } from '~/api/metro/lazy-registry';
import type { MetroStoreOptions } from '~/api/metro/types';
import type { find } from '~/api/metro/search';

export type TermOrOptions = string | MetroStoreOptions;

type Finder = (...args: TermOrOptions[]) => ReturnType<typeof JSON.parse>;

type ProvidedFinder = (...args: never[]) => ReturnType<typeof JSON.parse>;

export type Finders = {
	findByProps: ProvidedFinder;
	findByName: ProvidedFinder;
	findByFilePath: ProvidedFinder;
	findByPrototypes: ProvidedFinder;
	findStore: ProvidedFinder;
	find: typeof find;
};

let provided: Finders | undefined;

/**
 * @description Hands the metro search functions to the lazy wrappers, so they never import the search module.
 * @param finders The search functions.
 */
export function provideFinders(finders: Finders) {
	provided = finders;
}

/**
 * @description Reads one search function once the metro search has loaded.
 * @param name The search function.
 * @returns The search function.
 */
export function finder(name: 'find'): Finders['find'];
export function finder(name: Exclude<keyof Finders, 'find'>): Finder;
export function finder(name: keyof Finders) {
	if (!provided) {
		throw new Error(`Metro search is not loaded yet, so ${name} cannot run.`);
	}

	return provided[name];
}

/**
 * @description Creates a lazy handle for a search that may run before the metro search has loaded.
 * @param name The search function.
 * @param args The search terms, optionally followed by an options bag.
 * @returns A lazy module proxy; reading it runs the search, and a patch on it waits for the module to load.
 */
export function findLazy(name: Exclude<keyof Finders, 'find'>, args: TermOrOptions[]): MetroExport {
	let search: MetroExport;

	// The `{ lazy: true }` search is made on first use, since a handle may be declared before the search module loads.
	function inner() {
		search ??= finder(name)(...withLazy(args));

		return search;
	}

	return createLazyModule(() => inner().module, {
		wait(onLoad) {
			const lazy = getLazyModule(inner());

			if (lazy) {
				return lazy.wait(onLoad);
			}

			// A bulk, `all` or `raw` search does not wait, so the patch resolves it as before.
			onLoad(inner().module);

			return noop;
		},
		adopt: (mdl) => getLazyModule(inner())?.adopt(mdl) ?? mdl,
		// As with `wait`, a search that cannot wait is resolved.
		presence: () =>
			getLazyModule(inner())?.presence() ?? (inner().module ? 'loaded' : 'missing'),
	});
}

function withLazy(args: TermOrOptions[]): TermOrOptions[] {
	const last = args.at(-1);

	if (typeof last === 'object') {
		return [...args.slice(0, -1), { ...last, lazy: true }];
	}

	return [...args, { lazy: true }];
}
