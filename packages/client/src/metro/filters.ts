import type { PredicateResult } from '@unbound-app/types';

import { CACHE_KEY } from '~/core/constants';

/** A module predicate, carrying its cache key and a `raw` flag, produced by every `by*` helper. */
export type MetroFilter = ((mdl: any, id: number | string) => PredicateResult) & {
	[CACHE_KEY]?: string;
	isRaw?: boolean;
	// The file path a `byFilePath` filter matches. Only a Discord-authored module reports one.
	filePath?: string;
};

type Combinator = 'all' | 'any';

type CombinedKeys = { kind: Combinator; keys: string[] };

// The sorted part keys of each keyed `all` and `any` filter, so a nested one of the same kind flattens into its parent's key.
const combinedKeys = new WeakMap<MetroFilter, CombinedKeys>();

/**
 * @description Builds a filter matching a module that exposes all of the given property names.
 * @param props The property names the module must expose.
 * @returns A {@link MetroFilter} matching modules that expose every given property.
 */
export function byProps(...props: string[]): MetroFilter {
	const filter: MetroFilter = (mdl) => {
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
export function byFilePath(path: string): MetroFilter {
	const filter = (mdl: any) => mdl.__filePath === path;

	filter[CACHE_KEY] = `byFilePath::${path}`;
	filter.isRaw = true;
	filter.filePath = path;

	return filter;
}

/**
 * @description Builds a filter matching a module whose prototype exposes all of the given method names.
 * @param prototypes The prototype method names the module's prototype must expose.
 * @returns A {@link MetroFilter} matching modules whose prototype exposes every given method.
 */
export function byPrototypes(...prototypes: string[]): MetroFilter {
	const filter: MetroFilter = (mdl) => {
		if (!mdl.prototype) {
			return false;
		}

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
 * @description Builds a filter matching a wrapped component, like one from `React.memo`, whose inner `type` has the given name.
 * @param name The `name` of the wrapped component's `type`.
 * @returns A {@link MetroFilter} matching the module whose `type` has that name.
 */
export function byTypeName(name: string): MetroFilter {
	const filter = (mdl: any) => mdl.type?.name === name;

	filter[CACHE_KEY] = `byTypeName::${name}`;

	return filter;
}

/**
 * @description Builds a filter matching a flux store by name, appending `Store` when `short` is set.
 * @param name The store name to match against.
 * @param short Whether to append `Store` to `name` before matching.
 * @returns A {@link MetroFilter} matching the flux store with that name.
 */
export function byFluxStore(name: string, short: boolean = true): MetroFilter {
	const named = short ? name + 'Store' : name;
	const filter = (mdl: any) => mdl._dispatcher && mdl.getName?.() === named;

	filter[CACHE_KEY] = `byStore::${named}`;

	return filter;
}

/**
 * @description Builds a filter matching a module every part matches, testing the parts in order.
 * @param parts The filters to combine; none may be a raw filter such as `byFilePath`.
 * @returns A {@link MetroFilter} keyed by its parts' keys in any order, or unkeyed when a part is.
 */
export function all(...parts: MetroFilter[]): MetroFilter {
	const filter: MetroFilter = (mdl, id) => {
		for (let i = 0, len = parts.length; i < len; i++) {
			if (!parts[i](mdl, id)) {
				return false;
			}
		}

		return true;
	};

	return combine(filter, 'all', parts);
}

/**
 * @description Builds a filter matching a module any part matches, testing the parts in order.
 * @param parts The filters to combine; none may be a raw filter such as `byFilePath`.
 * @returns A {@link MetroFilter} keyed by its parts' keys in any order, or unkeyed when a part is.
 */
export function any(...parts: MetroFilter[]): MetroFilter {
	const filter: MetroFilter = (mdl, id) => {
		for (let i = 0, len = parts.length; i < len; i++) {
			if (parts[i](mdl, id)) {
				return true;
			}
		}

		return false;
	};

	return combine(filter, 'any', parts);
}

/**
 * @description Builds a filter matching a module the given filter does not match.
 * @param part The filter to negate; it may not be a raw filter such as `byFilePath`.
 * @returns A {@link MetroFilter} keyed by the part's key, or unkeyed when the part is.
 */
export function not(part: MetroFilter): MetroFilter {
	assertCombinable('not', part);

	const filter: MetroFilter = (mdl, id) => !part(mdl, id);
	const key = part[CACHE_KEY];

	if (key) {
		filter[CACHE_KEY] = `not(${JSON.stringify(key)})`;
	}

	return filter;
}

// A raw filter tests the module record, not its exports, so it cannot share a call with the other parts.
function assertCombinable(kind: Combinator | 'not', part: MetroFilter) {
	if (part.isRaw) {
		throw new TypeError(
			`Failed to combine filters: ${kind}() cannot take a raw filter such as byFilePath.`,
		);
	}
}

// A part without a key leaves the whole combination unkeyed: a partial key would let it answer for other filters.
function combine(filter: MetroFilter, kind: Combinator, parts: MetroFilter[]) {
	const keys: string[] = [];
	let keyed = true;

	for (const part of parts) {
		assertCombinable(kind, part);

		const nested = combinedKeys.get(part);

		if (nested?.kind === kind) {
			keys.push(...nested.keys);
		} else if (part[CACHE_KEY]) {
			keys.push(part[CACHE_KEY]);
		} else {
			keyed = false;
		}
	}

	if (!keyed) {
		return filter;
	}

	const sorted = [...new Set(keys)].sort();

	combinedKeys.set(filter, { kind, keys: sorted });
	filter[CACHE_KEY] = `${kind}(${sorted.map((key) => JSON.stringify(key)).join(',')})`;

	return filter;
}
