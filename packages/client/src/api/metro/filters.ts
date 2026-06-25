import type { PredicateResult } from '@unbound-app/types';

import { CACHE_KEY } from '~/lib/constants';

/** A module predicate, carrying its cache key and a `raw` flag, produced by every `by*` helper. */
export type MetroFilter = ((mdl: any, id: number | string) => PredicateResult) & {
	[CACHE_KEY]?: string;
	isRaw?: boolean;
};

/**
 * @description Builds a filter matching a module that exposes all of the given property names.
 * @param props The property names the module must expose.
 * @returns A {@link MetroFilter} matching modules that expose every given property.
 */
export function byProps(...props: string[]): MetroFilter {
	const filter = (mdl: any) => {
		if (props.length === 1) {
			return mdl[props[0]] !== void 0;
		}

		for (let i = 0, len = props.length; i < len; i++) {
			if (mdl[props[i]] === void 0) {
				return false;
			}
		}

		return true;
	};

	filter[CACHE_KEY] = `byProps::${props.sort().join('::')}`;

	return filter;
}

/**
 * @description Builds a filter matching a module whose tracked file path equals the given path.
 * @param path The file path the module must have been imported from.
 * @returns A {@link MetroFilter} matching the module loaded from that file path.
 */
export function byFilePath(path: string[]): MetroFilter {
	const filter = (mdl: any) => mdl.__filePath === path;

	filter[CACHE_KEY] = `byFilePath::${path}`;
	filter.isRaw = true;

	return filter;
}

/**
 * @description Builds a filter matching a module whose prototype exposes all of the given method names.
 * @param prototypes The prototype method names the module's prototype must expose.
 * @returns A {@link MetroFilter} matching modules whose prototype exposes every given method.
 */
export function byPrototypes(...prototypes: string[]): MetroFilter {
	const filter = (mdl: any) => {
		if (!mdl.prototype) return false;

		for (let i = 0, len = prototypes.length; i < len; i++) {
			if (mdl.prototype[prototypes[i]] === void 0) {
				return false;
			}
		}

		return true;
	};

	filter[CACHE_KEY] = `byPrototypes::${prototypes.sort().join('::')}`;

	return filter;
}

/**
 * @description Builds a filter matching a module whose `displayName` equals the given name.
 * @param name The `displayName` the module must have.
 * @returns A {@link MetroFilter} matching the module with that `displayName`.
 */
export function byDisplayName(name: string): MetroFilter {
	const filter = (mdl: any) => mdl.displayName === name;

	filter[CACHE_KEY] = `byDisplayName::${name}`;

	return filter;
}

/**
 * @description Builds a filter matching a module whose `name` equals the given name.
 * @param name The `name` the module must have.
 * @returns A {@link MetroFilter} matching the module with that `name`.
 */
export function byName(name: string): MetroFilter {
	const filter = (mdl: any) => mdl.name === name;

	filter[CACHE_KEY] = `byName::${name}`;

	return filter;
}

/**
 * @description Builds a filter matching a flux store by name, appending `Store` when `short` is set.
 * @param name The store name to match against.
 * @param short Whether to append `Store` to `name` before matching.
 * @returns A {@link MetroFilter} matching the flux store with that name.
 */
export function byStore(name: string, short: boolean = true): MetroFilter {
	const named = short ? name + 'Store' : name;
	const filter = (mdl: any) => mdl._dispatcher && mdl.getName?.() === named;

	filter[CACHE_KEY] = `byStore::${named}`;

	return filter;
}

export default { byProps, byDisplayName, byPrototypes, byName, byStore, byFilePath };
