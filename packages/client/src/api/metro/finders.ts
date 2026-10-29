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
