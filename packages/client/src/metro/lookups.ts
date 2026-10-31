import type {
	MetroFunctionSignatureOrArray,
	MetroPropertyRecordOrArray,
	MetroStringFindWithOptions,
	MetroInternalOptions,
	MetroSearchOptions,
	MetroBulkFind,
	AnyProps,
} from '~/metro/types';
import * as Search from '~/metro/search';

type LookupOptions = MetroInternalOptions & MetroSearchOptions;

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
 * @description Finds a module exposing all of the given property names. Lazy unless `{ lazy: false }` is passed: the search runs on first access.
 * @template U The union of requested property names.
 * @template T The argument tuple, optionally ending in search options or a bulk marker.
 * @param args The property names to search for, optionally followed by options.
 * @returns The matched module (or matches, for a bulk/`all` search).
 */
export function findByProps<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): MetroPropertyRecordOrArray<T, U> & {} {
	return Search.findByProps<U, T>(...lazyByDefault(args));
}

/**
 * @description Finds a module by a segment of its file path. Lazy unless `{ lazy: false }` is passed: the search runs on first access.
 * @template U The union of requested path segments.
 * @template T The argument tuple, optionally ending in search options or a bulk marker.
 * @param args The file path segment(s) to search for, optionally followed by options.
 * @returns The matched module.
 */
export function findByFilePath<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): AnyProps {
	return Search.findByFilePath<U, T>(...lazyByDefault(args));
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
 * @template U The union of requested names.
 * @template T The argument tuple, optionally ending in search options or a bulk marker.
 * @param args The name(s) to search for, optionally followed by options.
 * @returns The matched function (or matches, for a bulk/`all` search).
 */
export function findByName<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): MetroFunctionSignatureOrArray<T, U> {
	return Search.findByName<U, T>(...lazyByDefault(args));
}
