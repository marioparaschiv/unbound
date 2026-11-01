import '~/metro/registry';

import type { DiscordFunction } from '@unbound-app/types/components';

import type { MetroFilter } from '~/metro/filters';

/** Options that control internal search behaviour shared across every `findBy*` helper. */
export type MetroInternalOptions = {
	/** Treats each argument as its own search and resolves them all in one registry pass, one result per item. */
	bulk?: boolean;
	/** Returns a proxy that runs the search on first access instead of now. */
	lazy?: boolean;
};

/** Public options accepted by {@link find} and the `findBy*` family. */
export type MetroSearchOptions = {
	/** Also tests each module's `default` export when its exports do not match; `true` when omitted. */
	esModules?: boolean;
	/** Returns the `default` export rather than the whole module when `default` matched; `true` when omitted. */
	interop?: boolean;
	/** Matches an `all` search starts from; the search sets it itself when it rescans past the cache. */
	initial?: any[];
	/** Searches modules earlier searches found before scanning the whole registry; `true` when omitted. */
	cache?: boolean;
	/** Returns a proxy that runs the search on first access instead of now. */
	lazy?: boolean;
	/** Returns the Metro module record instead of its exports; `false` when omitted. */
	raw?: boolean;
	/** Returns every match as an array instead of the first match; `false` when omitted. */
	all?: boolean;
	/** Searches only the modules cached for this filter and never scans the registry; `false` when omitted. */
	cacheOnly?: boolean;
	/** Runs modules that have not loaded yet so they can be searched; `false` skips them. `true` when omitted. */
	initialize?: boolean;
};

/** Search options for `flux.getStore`, adding the `short` name-matching toggle. */
export type MetroStoreOptions = {
	short?: boolean;
} & MetroSearchOptions;

/** Search options for {@link findLazy}, adding a `signal` that abandons the wait when aborted. */
export type MetroLazySearchOptions = {
	signal?: AbortSignal;
} & Omit<MetroSearchOptions, 'lazy' | 'all'>;

/** A single entry in a {@link bulk} search: a filter plus its per-item options. */
export type MetroBulkItem = {
	filter: MetroFilter;
} & Omit<MetroSearchOptions, 'initial' | 'cache'>;

/** Called with each module's exports and id as the module loads. */
export type MetroModuleLoadListener = (mdl: any, id: number) => void;

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
type MetroParamsBag<T extends string> = {
	/** The prop names the lookup matches on. */
	params: T[];
};

/** The marker object distinguishing a bulk find from a single one. */
type MetroBulkMarker = {
	/** Always `true`: this find is one of several resolved in one pass. */
	bulk: true;
};

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
