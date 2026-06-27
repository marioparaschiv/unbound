import type { AnyProps, Fn } from '@unbound-app/types/utils';
import { createLogger } from '@unbound-app/logger';
import noop from '@unbound-app/utils/noop';

import Filters, { type MetroFilter } from '~/api/metro/filters';
import { blacklist, data } from '~/api/metro/state';
import Cache, { ModuleFlags } from '~/lib/cache';
import { CACHE_KEY } from '~/lib/constants';

/** Options that control internal search behaviour shared across every `findBy*` helper. */
export type MetroInternalOptions = {
	bulk?: boolean;
	lazy?: boolean;
};

/** Public options accepted by {@link find} and the `findBy*` family. */
export type MetroSearchOptions = {
	esModules?: boolean;
	interop?: boolean;
	initial?: any[];
	cache?: boolean;
	lazy?: boolean;
	raw?: boolean;
	all?: boolean;
	initialize?: boolean;
};

/** Search options for {@link findStore}, adding the `short` name-matching toggle. */
export interface MetroStoreOptions extends MetroSearchOptions {
	short?: boolean;
}

/** A single entry in a {@link bulk} search: a filter plus its per-item options. */
export interface MetroBulkItem extends Omit<MetroSearchOptions, 'initial' | 'cache'> {
	filter: MetroFilter;
}

/** Tuple of search terms followed by a trailing options object. */
export type MetroStringFindWithOptions<T extends string, Options = MetroSearchOptions> = [
	...T[],
	Options,
];

/** A bag carrying a `params` array of prop names. */
type MetroParamsBag<T extends string> = { params: T[] };

/** The marker object distinguishing a bulk find from a single one. */
type MetroBulkMarker = { bulk: true };

/** A record keyed by the non-options entries of a find argument tuple. */
type MetroPropsRecord<T extends any[]> = {
	[k in Exclude<T[number], Record<PropertyKey, any>>]: any;
};

/** A record keyed by the prop names listed in a single bulk item's `params`. */
type MetroParamsRecord<Params extends PropertyKey[]> = { [P in Params[number]]: any };

/** Tuple of param bags followed by a `{ bulk: true }` marker, describing a bulk find. */
export type MetroBulkFind<T extends string> = [
	...AnyProps<MetroParamsBag<T>>[],
	AnyProps<MetroBulkMarker>,
];

/** Widens a single result to an array when the search was made with `all: true`. */
export type MetroAllValues<T extends Record<PropertyKey, any>, U extends unknown> = T extends {
	all: true;
}
	? U[]
	: U;

/** Result shape of a by-property search: a record keyed by the requested props. */
export type MetroSingleModuleByProperty<T extends any[]> = T extends [
	...any,
	infer O extends MetroSearchOptions,
]
	? MetroAllValues<O, AnyProps<MetroPropsRecord<T>>>
	: AnyProps<MetroPropsRecord<T>>;

/** Result shape of a by-name search: the matched function (or its default export). */
export type MetroSingleModuleByName<T extends any[]> = T extends [
	...any,
	infer O extends MetroSearchOptions,
]
	? MetroAllValues<O, O extends { interop: false } ? { default: Fn } : Fn>
	: Fn;

/** Result shape of a bulk by-property search, one record per requested item. */
export type MetroBulkModuleByProperty<T extends any[]> = {
	[K in keyof T]: AnyProps<MetroParamsRecord<T[K]['params']>>;
};

/** Result shape of a bulk by-name search, one function per requested item. */
export type MetroBulkModuleByName<T extends any[]> = {
	[K in keyof T]: T[K] extends { interop: false } ? { default: Fn } : Fn;
};

/** Dispatches to the bulk or single by-property result shape based on the argument tuple. */
export type MetroPropertyRecordOrArray<T extends any[], U extends string> =
	T extends MetroBulkFind<U> ? MetroBulkModuleByProperty<T> : MetroSingleModuleByProperty<T>;

/** Dispatches to the bulk or single by-name result shape based on the argument tuple. */
export type MetroFunctionSignatureOrArray<T extends any[], U extends string> =
	T extends MetroBulkFind<U> ? MetroBulkModuleByName<T> : MetroSingleModuleByName<T>;

/** Convenience alias for a by-property result derived from a union of prop names. */
export type MetroModule<TProps extends string> = MetroPropertyRecordOrArray<TProps[], TProps>;

const Logger = createLogger('Metro');

// Walk the entire module registry once at import time, wrapping each module factory so we can
// track the importing module, harden invalid exports, and run our patches as modules initialize.
for (let i = 0, len = Cache.moduleIds.length; i < len; i++) {
	const id = Cache.moduleIds[i];
	const mdl = window.modules.get(id);

	if (Cache.hasModuleFlag(id, ModuleFlags.BLACKLISTED)) {
		blacklist.add(id);
		continue;
	}

	if (mdl.factory) {
		const orig = mdl.factory;

		mdl.factory = function (...args) {
			try {
				const originalImportingId = data.importingModuleId;
				data.importingModuleId = id;

				const [, metroRequire, , , moduleObject] = args;

				args[2] = (id: number) => {
					const exps = metroRequire(id);
					return exps && exps.__esModule ? exps.default : exps;
				};

				args[3] = (id: number) => {
					const exps = metroRequire(id);
					if (exps && exps.__esModule) return exps;

					const importAll: Record<string, any> = {};
					if (exps) Object.assign(importAll, exps);
					importAll.default = exps;

					return importAll;
				};

				orig.apply(self, args);

				const exported = moduleObject.exports;

				if (isInvalidExport(exported)) {
					Cache.addModuleFlag(moduleObject.id, ModuleFlags.BLACKLISTED);
					blacklist.add(moduleObject.id);
				} else {
					onModuleRequire(exported, id);
				}

				data.importingModuleId = originalImportingId;
			} catch {
				Cache.addModuleFlag(id, ModuleFlags.BLACKLISTED);
				blacklist.add(id);
			}
		};
	} else {
		const exported = mdl.publicModule?.exports;

		if (isInvalidExport(exported)) {
			Cache.addModuleFlag(id, ModuleFlags.BLACKLISTED);
			blacklist.add(id);
		} else {
			onModuleRequire(exported, id);
		}
	}
}

/**
 * @description Runs one-time patches against a module's exports the first time it is required:
 * blacklisting the RTN profiler, hardening `requireNativeComponent`, and hooking the import tracker.
 * @param exports The module's resolved exports.
 * @param id The id of the module being required.
 */
function onModuleRequire(exports: any, id: number) {
	if (!exports) return;

	if (!data.patchedRTNProfiler && exports?.getEnforcing && exports?.get) {
		const offender = id + 1;

		Cache.addModuleFlag(offender, ModuleFlags.BLACKLISTED);
		blacklist.add(offender);

		data.patchedRTNProfiler = true;
	}

	if (!data.patchedNativeRequire && exports.default?.name === 'requireNativeComponent') {
		const orig = exports.default;

		exports.default = function requireNativeComponent(...args) {
			try {
				return orig.apply(this, args);
			} catch {
				return args[0];
			}
		};

		data.patchedNativeRequire = true;
	}

	if (!data.patchedImportTracker && exports.fileFinishedImporting) {
		const orig = exports.fileFinishedImporting;

		exports.fileFinishedImporting = function (...args) {
			const [filePath] = args;

			if (filePath && data.importingModuleId !== -1) {
				const module = window.modules.get(data.importingModuleId);
				module.__filePath = filePath;
			}

			const result = orig.apply(this, args);
			return result;
		};

		data.patchedImportTracker = true;
	}
}

/**
 * @description Registers a listener invoked with every module as it is required.
 * @param listener Callback receiving the module exports and its id.
 * @returns A function that removes the listener.
 */
export function addListener(listener: (mdl: any, id: string) => void) {
	data.listeners.add(listener);
	return () => data.listeners.delete(listener);
}

/**
 * @description Removes a previously registered module listener.
 * @param listener The listener to remove.
 */
export function removeListener(listener: (mdl: any, id: string) => void) {
	data.listeners.delete(listener);
}

export const on = addListener;
export const off = removeListener;

/**
 * @description Resolves a module matching `filter`, waiting for it to load if it is not yet present.
 * @param filter The filter to match against.
 * @param options Search options, excluding `lazy` and `all`.
 * @returns The matched module, or a promise that resolves once a matching module is required.
 */
export function findLazy(
	filter: MetroFilter,
	options: Omit<MetroSearchOptions, 'lazy' | 'all'> = {},
) {
	const existing = find(filter, options);
	if (existing !== void 0) return existing;

	return new Promise((resolve) => {
		function callback(mdl, id) {
			if (filter(mdl, id)) {
				resolve(mdl);
				remove();
			}

			if (mdl.default && filter(mdl.default, id)) {
				resolve((options.interop ?? true) ? mdl.default : mdl);
				remove();
			}
		}

		const remove = addListener(callback);
	});
}

/**
 * @description Core synchronous module search. Tries the per-key cache fast-path first, then falls
 * back to scanning the registry, degrading gracefully if the supplied filter throws.
 * @param filter The filter to match modules against.
 * @param options Search options controlling interop, caching, esModule unwrapping, and `all`.
 * @returns The first matching module, an array of matches when `all` is set, or `null`.
 */
export function find(filter: MetroFilter, options: MetroSearchOptions = {}) {
	if (!filter) throw new Error('You must provide a filter to search by.');

	const {
		all = false,
		interop = true,
		cache: useCache = true,
		initial = null,
		esModules = true,
		raw = false,
	} = options;

	const result = { found: initial ?? [], errored: false };

	const search: MetroFilter = (mdl: any, id: number | string): boolean => {
		try {
			return !!filter(mdl, id);
		} catch (error) {
			if (result.errored) return false;
			result.errored = true;

			Logger.error(
				'Search filter threw an error, degrading performance.',
				'This will create a bad experience for the user including lag spikes, a slow startup, etc.',
				'Please fix this as soon as possible.',
				'\n',
				error instanceof Error ? error.stack : String(error),
			);

			return false;
		}
	};

	if (filter[CACHE_KEY]) {
		search[CACHE_KEY] = filter[CACHE_KEY];
	}

	if (filter.isRaw) {
		search.isRaw = true;
	}

	/****** CACHE ******/
	const cache = filter[CACHE_KEY] && Cache.getModuleCacheForKey(filter[CACHE_KEY]);

	if (cache) {
		for (const id of cache) {
			const rawModule = window.modules.get(id);
			if (!rawModule) continue;
			if (blacklist.has(id)) continue;

			if (!rawModule.isInitialized) {
				const initialized = initializeModule(id);
				if (!initialized) continue;
			}

			const found = searchExports(search, rawModule, id, esModules, interop, raw);
			if (!found) continue;
			if (!all) return found;

			result.found.push(found);
		}

		return all ? result.found : null;
	}
	/****** END CACHE ******/

	const store = useCache ? data.cache : window.modules;
	const keys = useCache ? [...store.keys()] : Cache.moduleIds;

	for (let i = 0, len = keys.length; i < len; i++) {
		const id = keys[i];
		const rawModule = store.get(id);
		if (blacklist.has(id)) continue;

		if (!rawModule.isInitialized) {
			const initialized = initializeModule(id);
			if (!initialized) continue;
		}

		const found = searchExports(search, rawModule, id, esModules, interop, raw);
		if (!found) continue;
		if (!all) return found;

		result.found.push(found);
	}

	if (useCache && !all && !result.found.length) {
		return find(filter, Object.assign(options, { cache: false }));
	} else if (useCache && all) {
		return find(filter, Object.assign(options, { cache: false, initial: result.found }));
	}

	return all ? result.found : null;
}

/**
 * @description Runs several filters in a single registry pass, returning one result per item.
 * @param items The filters to resolve, each with its own per-item options.
 * @returns An array of matches positionally aligned with `items`.
 */
export function bulk(...items: MetroBulkItem[]) {
	const result = Array.from<any>({ length: items.length });
	const hasAll = items.some((i) => i.all);

	find(
		((mdl, id) => {
			for (let i = 0, len = items.length; i < len; i++) {
				const item = items[i];
				if (!item.filter) continue;

				if (item.filter(mdl, id)) {
					if (item.all) {
						result[i] ??= [];
						result[i].push(mdl);
						continue;
					}

					result[i] = mdl;
					continue;
				}

				if (mdl.default && item.filter(mdl.default, id)) {
					const payload = (item.interop ?? true) ? mdl.default : mdl;

					if (item.all) {
						result[i] ??= [];
						result[i].push(payload);
						continue;
					}

					result[i] = payload;
				}
			}

			// Loop through whole registry if any of the items have "all" as an option
			return hasAll ? false : result.filter(Boolean).length === items.length;
		}) as MetroFilter,
		{ interop: false },
	);

	return result;
}

/**
 * @description Finds a module exposing all of the given property names.
 * @template U The union of requested property names.
 * @template T The argument tuple, optionally ending in search options or a bulk marker.
 * @param args The property names to search for, optionally followed by options.
 * @returns The matched module (or matches, for a bulk/`all` search).
 */
export function findByProps<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): MetroPropertyRecordOrArray<T, U> & {} {
	const [props, options] = parseOptions<MetroInternalOptions, T>(args);

	return searchWithOptions(props, options, 'byProps');
}

/**
 * @description Finds a module by a segment of its file path.
 * @template U The union of requested path segments.
 * @template T The argument tuple, optionally ending in search options or a bulk marker.
 * @param args The file path segment(s) to search for, optionally followed by options.
 * @returns The matched module.
 */
export function findByFilePath<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): AnyProps {
	const [name, options] = parseOptions<MetroInternalOptions, T>(args);

	return searchWithOptions(name, options, 'byFilePath');
}

/**
 * @description Finds a module whose prototype exposes all of the given method names.
 * @template U The union of requested prototype method names.
 * @template T The argument tuple, optionally ending in search options or a bulk marker.
 * @param args The prototype method names to search for, optionally followed by options.
 * @returns The matched module.
 */
export function findByPrototypes<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): AnyProps {
	const [prototypes, options] = parseOptions<MetroInternalOptions, T>(args);

	return searchWithOptions(prototypes, options, 'byPrototypes');
}

/**
 * @description Finds a flux store by name.
 * @template U The union of requested store names.
 * @template T The argument tuple, optionally ending in store search options.
 * @param args The store name(s) to search for, optionally followed by options (`short` defaults to `true`).
 * @returns The matched store.
 */
export function findStore<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U, MetroStoreOptions>,
>(...args: T): AnyProps {
	const [[name], { short = true, ...options }] = parseOptions<MetroStoreOptions>(args);

	return searchWithOptions([name, short], options as MetroInternalOptions, 'byStore');
}

/**
 * @description Finds a module by the name of its default export.
 * @template U The union of requested names.
 * @template T The argument tuple, optionally ending in search options or a bulk marker.
 * @param args The name(s) to search for, optionally followed by options.
 * @returns The matched function (or matches, for a bulk/`all` search).
 */
export function findByName<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): MetroFunctionSignatureOrArray<T, U> {
	const [name, options] = parseOptions<MetroInternalOptions, T>(args);

	return searchWithOptions(name, options, 'byName');
}

/**
 * @description Forces a module to initialise via metro's `__r`, blacklisting it if it throws.
 * @param id The id of the module to initialise.
 * @returns `true` if the module is initialised, `false` if it was blacklisted.
 */
export function initializeModule(id: number) {
	if (blacklist.has(id)) return false;

	const module = window.modules.get(id);
	if (module?.isInitialized && !module?.hasError) {
		return true;
	}

	const originalHandler = ErrorUtils.getGlobalHandler();
	ErrorUtils.setGlobalHandler(noop);

	try {
		__r(id);

		if (Function.prototype.toString !== data.origToString) {
			Object.defineProperty(Function.prototype, 'toString', {
				value: data.origToString,
				configurable: true,
				writable: true,
			});
		}

		return true;
	} catch {
		Cache.addModuleFlag(id, ModuleFlags.BLACKLISTED);
		blacklist.add(id);

		return false;
	} finally {
		ErrorUtils.setGlobalHandler(originalHandler);
	}
}

/**
 * @description Tests a single module's exports against a filter, caching and unwrapping on a hit.
 * @param filter The filter to match against.
 * @param rawModule The raw metro module record.
 * @param id The module's id.
 * @param esModules Whether to also test the module's `default` export.
 * @param interop Whether to unwrap to `default` on an esModule hit.
 * @param raw Whether to return the raw module record instead of its exports.
 * @returns The matched exports (or raw module), or `null` on no match.
 */
function searchExports(
	filter: MetroFilter,
	rawModule: any,
	id: number,
	esModules: boolean = true,
	interop: boolean = true,
	raw: boolean = false,
) {
	const mdl = rawModule.publicModule.exports;
	if (!mdl) return null;

	if (isInvalidExport(mdl)) {
		Cache.addModuleFlag(id, ModuleFlags.BLACKLISTED);
		blacklist.add(id);

		return null;
	}

	if (filter(filter.isRaw ? rawModule : mdl, id)) {
		if (filter[CACHE_KEY]) {
			Cache.addCachedIDForKey(filter[CACHE_KEY], id);
		}

		data.cache.set(id, rawModule);

		return raw ? rawModule : mdl;
	}

	if (!filter.isRaw && esModules && mdl.default && filter(mdl.default, id)) {
		if (filter[CACHE_KEY]) {
			Cache.addCachedIDForKey(filter[CACHE_KEY], id);
		}

		data.cache.set(id, rawModule);

		return raw ? rawModule : interop ? mdl.default : mdl;
	}
}

/**
 * @description Shared back-end for the `findBy*` family. Handles lazy proxying, named-filter
 * resolution, and bulk dispatch before delegating to {@link find}.
 * @param args The search terms (and any per-item param bags for bulk searches).
 * @param options Internal options controlling `lazy` and `bulk` behaviour.
 * @param filter A filter function, or the name of a {@link Filters} entry to resolve.
 * @returns A lazy proxy, a bulk result array, or the result of {@link find}.
 */
function searchWithOptions(args: any[], options: MetroInternalOptions, filter: Fn | string) {
	if (options.lazy) {
		let cache;

		return new Proxy(
			{
				__METRO_LAZY__: true,
				get module() {
					return cache;
				},
			},
			{
				get(_, prop) {
					if (!prop || typeof prop !== 'string') return;

					cache ??= searchWithOptions(
						args,
						Object.assign(options, { lazy: false }),
						filter,
					);

					if (prop === 'module') {
						return cache;
					}

					return cache?.[prop];
				},
				set(_, prop, value) {
					cache ??= searchWithOptions(
						args,
						Object.assign(options, { lazy: false }),
						filter,
					);

					return Object.defineProperty(cache ?? {}, prop, {
						value,
						writable: true,
						configurable: true,
					});
				},
			},
		);
	}

	if (typeof filter === 'string') {
		filter = Filters[filter] as MetroFilter;
	}

	if (!filter) return;

	if (options.bulk) {
		return bulk(
			...args.map((payload) => {
				if (!Array.isArray(payload) && typeof payload === 'object' && payload.params) {
					return {
						filter: (filter as MetroFilter)(...((payload.params ?? []) as [any, any])),
						...payload,
					};
				}

				return {
					filter: (filter as MetroFilter)(...(payload as [any, any])),
					interop: true,
				};
			}),
		);
	}

	return find(filter(...args), options as MetroSearchOptions);
}

// Sentinel key no real module owns, used to detect catch-all proxies. Defined once so the probe is
// a plain property lookup with no per-call allocation.
const INVALID_EXPORT_SYMBOL = Symbol('is-invalid-export');

/**
 * @description Detects a "catch-all" proxy: an object whose `has` trap claims it contains keys it
 * does not actually own. Discord ships dozens of these (e.g. TurboModule proxies), and because
 * `in` property reads against them return truthy stubs for arbitrary names, they false-match
 * property-based filters (`findByProps('Messages', ...)` etc.) and poison searches. We probe with a
 * sentinel key that no real module could own.
 * @param mdl The exports to test.
 * @returns `true` if `mdl` is a catch-all proxy.
 */
function isCatchAllProxy(mdl: any): boolean {
	if (!mdl || typeof mdl !== 'object') return false;

	try {
		return INVALID_EXPORT_SYMBOL in mdl && !Object.hasOwn(mdl, INVALID_EXPORT_SYMBOL);
	} catch {
		return false;
	}
}

/**
 * @description Guards against exports that must never be returned from a search (nullish, the
 * global object, explicitly-marked invalid modules, catch-all proxies, or the intl messages proxy).
 * @param mdl The exports to test.
 * @returns `true` if the exports are invalid and should be skipped.
 */
function isInvalidExport(mdl: any) {
	return (
		!mdl ||
		mdl === globalThis ||
		mdl[INVALID_EXPORT_SYMBOL] === null ||
		mdl.default?.[Symbol.toStringTag] === 'IntlMessagesProxy' ||
		isCatchAllProxy(mdl) ||
		isCatchAllProxy(mdl.default)
	);
}

/**
 * @description Splits an argument list into its search terms and a trailing options object.
 * @template O The options type.
 * @template A The search-terms tuple type.
 * @param args The raw arguments, optionally ending in an options object.
 * @param filter Predicate deciding whether the last argument is an options object.
 * @param fallback Options to use when no trailing options object is present.
 * @returns A tuple of `[searchTerms, options]`.
 */
function parseOptions<O, A extends any[] = string[]>(
	args: [...A, any] | A,
	filter = (last) => typeof last === 'object' && !Array.isArray(last),
	fallback = {},
): [A, O] {
	return [args as A, filter(args[args.length - 1]) ? args.pop() : fallback];
}

export { blacklist, data } from '~/api/metro/state';
export * as filters from '~/api/metro/filters';
export * as common from '~/api/metro/common';
export * as stores from '~/api/metro/stores';
export { CACHE_KEY } from '~/lib/constants';
export * as api from '~/api/metro/api';
