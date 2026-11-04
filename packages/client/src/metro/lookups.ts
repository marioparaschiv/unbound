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
	MetroBulkFind,
	AnyProps,
} from '~/metro/types';
import type { MetroFilter } from '~/metro/filters';
import * as Search from '~/metro/search';

type LookupOptions = MetroInternalOptions & MetroSearchOptions;

// Untyped on purpose: relating the search's generic result to a lookup's would expand Discord's whole module index.
type UntypedSearch = (...args: MetroExport[]) => MetroExport;

function isOptions(value: unknown): value is LookupOptions {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
 * @returns The matched module, an array of matches when `all` is set, or `null`.
 */
export function find(filter: MetroFilter, options: MetroSearchOptions = {}) {
	const [, resolved] = lazyByDefault<[MetroFilter, LookupOptions]>([filter, options]);

	return Search.find(filter, resolved);
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
>(first: K, ...rest: T): MetroPropertyRecordOrArray<[K, ...T], string> & {};
export function findByProps<T extends MetroLookupArgs<string>>(
	...args: T
): MetroPropertyRecordOrArray<T, string> & {};
export function findByProps(...args: MetroExport[]) {
	return (Search.findByProps as UntypedSearch)(...lazyByDefault(args));
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
	return (Search.findByFilePath as UntypedSearch)(...lazyByDefault(args));
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
	return Search.findByPrototypes<U, T>(...lazyByDefault(args));
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
	return (Search.findByName as UntypedSearch)(...lazyByDefault(args));
}
