import type { MetroModuleName, MetroModulePath, MetroPropName } from '@unbound-app/types/metro';

import type {
	MetroFunctionSignatureOrArray,
	MetroPropertyRecordOrArray,
	MetroStringFindWithOptions,
	MetroInternalOptions,
	MetroLookupArgs,
	MetroLookupFirst,
	MetroModuleOrArray,
	MetroSearchOptions,
	MetroStoreOptions,
	MetroBulkFind,
	AnyProps,
} from '~/metro/types';
import {
	byFilePath,
	byFluxStore,
	byName,
	byProps,
	byPrototypes,
	type MetroFilter,
} from '~/metro/filters';
import { createLazyModule } from '~/metro/lazy-registry';
import { bulk, find as search } from '~/metro/search';
import { filterPresence } from '~/metro/presence';
import { CACHE_KEY } from '~/metro/cache-key';
import { onModuleLoaded } from '~/metro/wait';
import { isKeyMissing } from '~/metro/cache';

type LookupOptions = MetroInternalOptions & MetroSearchOptions;

function isOptions(value: unknown): value is LookupOptions {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A lookup is lazy unless it passes `lazy: false`, or stands for several modules (`all`, `bulk`).
function lazyByDefault<T extends unknown[]>(args: T): T {
	const last = args[args.length - 1];

	if (!isOptions(last)) {
		return [...args, { lazy: true }] as T;
	}

	const lazy = last.lazy ?? !(last.all || last.bulk);

	return [...args.slice(0, -1), { ...last, lazy }] as T;
}

/**
 * @description Finds a module matching a filter. Lazy unless `{ lazy: false }` is passed, or `all` is set: the search runs on first access.
 * @param filter The filter to match modules against: a built-in, a combination, or a predicate you write, which the build keys for the cache.
 * @param options Search options controlling interop, caching, esModule unwrapping, and `all`.
 * @returns The matched module, an array of matches when `all` is set, `undefined` when the cache knows it is missing, or `null`.
 */
export function find(filter: MetroFilter, options: MetroSearchOptions = {}) {
	if (!filter) {
		throw new Error('You must provide a filter to search by.');
	}

	const [, resolved] = lazyByDefault<[MetroFilter, LookupOptions]>([filter, options]);

	if (knownMissing(filter, resolved)) return;

	if (resolved.lazy) {
		return searchWithOptions([], resolved, () => filter);
	}

	return search(filter, resolved);
}

/**
 * @description Finds a module exposing all of the given property names. Lazy unless `{ lazy: false }` is passed: the search runs on first access.
 * @template K The first property name, autocompleted from Discord's module exports.
 * @template T The other arguments, optionally ending in search options or a bulk marker.
 * @param first The first property name to search for.
 * @param rest The other property names, optionally followed by options.
 * @returns The matched module (or matches, for a bulk/`all` search), typed from Discord's modules when the props are known.
 */
// The first argument is its own parameter so editors complete it; a spread signature takes a runtime array.
export function findByProps<
	K extends MetroLookupFirst<MetroPropName>,
	T extends MetroLookupArgs<string>,
>(first: K, ...rest: T): MetroPropertyRecordOrArray<[K, ...T], string>;
export function findByProps<T extends MetroLookupArgs<string>>(
	...args: T
): MetroPropertyRecordOrArray<T, string>;
export function findByProps(...args: MetroExport[]) {
	return lookup(args, byProps);
}

/**
 * @description Finds a module by a segment of its file path. Lazy unless `{ lazy: false }` is passed: the search runs on first access.
 * @template K The file path, autocompleted from Discord's modules.
 * @template T The other arguments, optionally ending in search options or a bulk marker.
 * @param first The file path to search for.
 * @param rest Options, or further bulk items.
 * @returns The matched module, typed from Discord's modules when the path is known.
 */
export function findByFilePath<
	K extends MetroLookupFirst<MetroModulePath>,
	T extends MetroLookupArgs<string>,
>(first: K, ...rest: T): MetroModuleOrArray<[K, ...T], string>;
export function findByFilePath<T extends MetroLookupArgs<string>>(
	...args: T
): MetroModuleOrArray<T, string>;
export function findByFilePath(...args: MetroExport[]) {
	return lookup(args, byFilePath);
}

/**
 * @description Finds a module whose prototype exposes all of the given method names. Lazy unless `{ lazy: false }` is passed: the search runs on first access.
 * @template U The union of requested prototype method names.
 * @template T The argument tuple, optionally ending in search options or a bulk marker.
 * @param args The prototype method names to search for, optionally followed by options.
 * @returns The matched module.
 */
export function findByPrototypes<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): AnyProps {
	return lookup(args, byPrototypes);
}

/**
 * @description Finds a module by the name of its default export. Lazy unless `{ lazy: false }` is passed: the search runs on first access.
 * @template K The name, autocompleted from Discord's default exports.
 * @template T The other arguments, optionally ending in search options or a bulk marker.
 * @param first The name to search for.
 * @param rest Options, or further bulk items.
 * @returns The matched function (or matches, for a bulk/`all` search), typed from Discord's modules when the name is known.
 */
export function findByName<
	K extends MetroLookupFirst<MetroModuleName>,
	T extends MetroLookupArgs<string>,
>(first: K, ...rest: T): MetroFunctionSignatureOrArray<[K, ...T], string>;
export function findByName<T extends MetroLookupArgs<string>>(
	...args: T
): MetroFunctionSignatureOrArray<T, string>;
export function findByName(...args: MetroExport[]) {
	return lookup(args, byName);
}

/**
 * @description Finds a Flux store by name. Lazy unless `{ lazy: false }` is passed: the search runs on first access.
 * @template U The union of requested store names.
 * @template T The argument tuple, optionally ending in store search options.
 * @param args The store name(s) to search for, optionally followed by options (`short` defaults to `true`).
 * @returns The matched store.
 */
export function findStore<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U, MetroStoreOptions>,
>(...args: T): MetroExport {
	const [[name], { short = true, ...options }] = parseOptions<MetroStoreOptions>(
		lazyByDefault(args),
	);

	return searchWithOptions([name, short], options, byFluxStore);
}

function lookup(args: MetroExport[], filter: (...args: MetroExport[]) => MetroFilter) {
	const [terms, options] = parseOptions<LookupOptions, MetroExport[]>(lazyByDefault(args));

	if (!options.bulk && knownMissing(filter(...terms), options)) return;

	return searchWithOptions(terms, options, filter);
}

// A lazy handle on a module a full search of this build found missing would never resolve, so the lookup returns nothing.
function knownMissing(filter: MetroFilter, options: LookupOptions): boolean {
	return Boolean(options.lazy && !options.all && !options.raw && isKeyMissing(filter[CACHE_KEY]));
}

/**
 * @description Runs a lookup: a lazy handle that searches on first use, a bulk search, or an eager {@link search}.
 * @param args The search terms (and any per-item param bags for bulk searches).
 * @param options Internal options controlling `lazy` and `bulk` behaviour.
 * @param filter The filter builder for the search terms.
 * @returns A lazy proxy, a bulk result array, or the result of {@link search}.
 */
function searchWithOptions(
	args: MetroExport[],
	options: LookupOptions,
	filter: (...args: MetroExport[]) => MetroFilter,
) {
	if (options.lazy) {
		const resolve = () =>
			searchWithOptions(args, Object.assign(options, { lazy: false }), filter);

		// A bulk or `all` search stands for several modules, and a `raw` one for a module record, so a
		// patch on such a proxy resolves it instead of waiting.
		if (options.bulk || options.all || options.raw) {
			return createLazyModule(resolve);
		}

		const { esModules, interop } = options;

		return createLazyModule(resolve, {
			wait: (callback) => onModuleLoaded(filter(...args), callback, { esModules, interop }),
			presence: () => filterPresence(filter(...args), { esModules, interop }),
		});
	}

	if (options.bulk) {
		return bulk(
			...args.map((payload) => {
				if (!Array.isArray(payload) && typeof payload === 'object' && payload.params) {
					return {
						filter: filter(...((payload.params ?? []) as [MetroExport, MetroExport])),
						...payload,
					};
				}

				return {
					filter: filter(...(payload as [MetroExport, MetroExport])),
					interop: true,
				};
			}),
		);
	}

	return search(filter(...args), options);
}

/**
 * @description Splits an argument list into its search terms and a trailing options object.
 * @template O The options type.
 * @template A The search-terms tuple type.
 * @param args The raw arguments, ending in an options object.
 * @returns A tuple of `[searchTerms, options]`.
 */
function parseOptions<O, A extends MetroExport[] = string[]>(
	args: [...A, MetroExport] | A,
): [A, O] {
	return [args as A, args.pop()];
}
