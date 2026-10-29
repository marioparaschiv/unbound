import '~/api/metro/registry';

import type { DiscordFunction } from '@unbound-app/types/components';

import type { MetroFilter } from '~/api/metro/filters';

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
	cacheOnly?: boolean;
	initialize?: boolean;
};

/** Search options for {@link findStore}, adding the `short` name-matching toggle. */
export type MetroStoreOptions = {
	short?: boolean;
} & MetroSearchOptions;

/** Options for {@link onModuleLoaded}: whether to also match a module's `default` export, and to return it on such a match. */
export type MetroModuleLoadedOptions = Pick<MetroSearchOptions, 'esModules' | 'interop'>;

/**
 * What is known of a module without initializing it: `loaded` once initialized, `present` when an earlier search
 * found it in this build, `missing` when a full search of this build found nothing, and `unknown` otherwise.
 */
export type MetroModulePresence = 'loaded' | 'present' | 'missing' | 'unknown';

/** Options for {@link waitForModule}, adding a `signal` that abandons the wait when aborted. */
export type MetroWaitForModuleOptions = {
	signal?: AbortSignal;
} & MetroModuleLoadedOptions;

/** A single entry in a {@link bulk} search: a filter plus its per-item options. */
export type MetroBulkItem = {
	filter: MetroFilter;
} & Omit<MetroSearchOptions, 'initial' | 'cache'>;

/** Tuple of search terms followed by a trailing options object. */
export type MetroStringFindWithOptions<T extends string, Options = MetroSearchOptions> = [
	...T[],
	Options,
];

/** An object of shape `T` widened with an arbitrary property index. */
export type AnyProps<T = unknown> = T & Record<PropertyKey, MetroExport>;

/** A function or class exported by a Discord module, whose signature Discord does not document. */
export type MetroFunction = DiscordFunction & (new (...args: any[]) => any);

/** A bag carrying a `params` array of prop names. */
type MetroParamsBag<T extends string> = { params: T[] };

/** The marker object distinguishing a bulk find from a single one. */
type MetroBulkMarker = { bulk: true };

/** A record keyed by the non-options entries of a find argument tuple. */
type MetroPropsRecord<T extends any[]> = {
	[k in Exclude<T[number], object>]: MetroExport;
};

/** A record keyed by the prop names listed in a single bulk item's `params`. */
type MetroParamsRecord<Params extends PropertyKey[]> = { [P in Params[number]]: MetroExport };

/** Tuple of param bags followed by a `{ bulk: true }` marker, describing a bulk find. */
export type MetroBulkFind<T extends string> = [
	...AnyProps<MetroParamsBag<T>>[],
	AnyProps<MetroBulkMarker>,
];

/** Widens a single result to an array when the search was made with `all: true`. */
export type MetroAllValues<T extends MetroSearchOptions, U> = T extends {
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
	? MetroAllValues<O, O extends { interop: false } ? { default: MetroFunction } : MetroFunction>
	: MetroFunction;

/** Result shape of a bulk by-property search, one record per requested item. */
export type MetroBulkModuleByProperty<T extends any[]> = {
	[K in keyof T]: AnyProps<MetroParamsRecord<T[K]['params']>>;
};

/** Result shape of a bulk by-name search, one function per requested item. */
export type MetroBulkModuleByName<T extends any[]> = {
	[K in keyof T]: T[K] extends { interop: false } ? { default: MetroFunction } : MetroFunction;
};

/** Dispatches to the bulk or single by-property result shape based on the argument tuple. */
export type MetroPropertyRecordOrArray<T extends any[], U extends string> =
	T extends MetroBulkFind<U> ? MetroBulkModuleByProperty<T> : MetroSingleModuleByProperty<T>;

/** Dispatches to the bulk or single by-name result shape based on the argument tuple. */
export type MetroFunctionSignatureOrArray<T extends any[], U extends string> =
	T extends MetroBulkFind<U> ? MetroBulkModuleByName<T> : MetroSingleModuleByName<T>;

/** Convenience alias for a by-property result derived from a union of prop names. */
export type MetroModule<TProps extends string> = MetroPropertyRecordOrArray<TProps[], TProps>;
