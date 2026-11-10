import type { PredicateResult } from '@unbound-app/types';

import type { MetroFilter } from '~/metro/filters';
import { CACHE_KEY } from '~/metro/cache-key';

/** A value a filter argument may hold: its JSON is part of the filter's cache key. */
export type FilterArgument =
	| string
	| number
	| boolean
	| null
	| FilterArgument[]
	| { [key: string]: FilterArgument };

/** A predicate taking a module and a filter's arguments; the build gives it a cache key from its source. */
export type FilterPredicate<A extends FilterArgument[]> = ((
	mdl: MetroExport,
	...args: A
) => PredicateResult) & {
	[CACHE_KEY]?: string;
};

function isFilterArgument(value: unknown): value is FilterArgument {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') {
		return true;
	}

	if (typeof value === 'number') {
		return Number.isFinite(value);
	}

	if (Array.isArray(value)) {
		return value.every(isFilterArgument);
	}

	if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
		return false;
	}

	return Object.values(value).every(isFilterArgument);
}

/**
 * @description Defines a reusable filter that takes arguments. Its cache key is the build's hash of `predicate`'s source plus the arguments' JSON, so every plugin defining the same filter shares one cache entry.
 * @template A The argument tuple the filter takes.
 * @param predicate Tests a module against the arguments; it may read only its parameters and globals.
 * @returns A function building the {@link MetroFilter} for a set of arguments.
 */
export function filter<A extends FilterArgument[]>(
	predicate: FilterPredicate<A>,
): (...args: A) => MetroFilter {
	const key = predicate[CACHE_KEY];

	return (...args) => {
		const built: MetroFilter = (mdl) => predicate(mdl, ...args);

		// An argument JSON can't spell, such as a function or `undefined`, would collide with another, so it stays unkeyed.
		if (key && args.every(isFilterArgument)) {
			built[CACHE_KEY] = `${key}::${JSON.stringify(args)}`;
		}

		return built;
	};
}
