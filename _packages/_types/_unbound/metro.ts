import type { CACHE_KEY } from './constants';
import type { AnyProps, Fn } from './utils';


export type MetroInternalOptions = {
	bulk?: boolean;
	lazy?: boolean;
};

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

export interface MetroStoreOptions extends MetroSearchOptions {
	short?: boolean;
}

export interface MetroBulkItem extends Omit<MetroSearchOptions, 'initial' | 'cache'> {
	filter: MetroFilter;
}

export type MetroStringFindWithOptions<T extends string, Options = MetroSearchOptions> = [...T[], Options];
export type MetroBulkFind<T extends string> = [...AnyProps<{ params: T[]; }>[], AnyProps<{ bulk: true; }>];
export type MetroAllValues<T extends Record<PropertyKey, any>, U extends unknown> = T extends { all: true; } ? U[] : U;

export type MetroSingleModuleByProperty<T extends any[]> = T extends [...any, infer O extends MetroSearchOptions]
	? MetroAllValues<O, AnyProps<{ [k in Exclude<T[number], Record<PropertyKey, any>>]: any }>>
	: AnyProps<{ [k in Exclude<T[number], Record<PropertyKey, any>>]: any }>;

export type MetroSingleModuleByName<T extends any[]> = T extends [...any, infer O extends MetroSearchOptions]
	? MetroAllValues<O, O extends { interop: false; }
		? { default: Fn; }
		: Fn>
	: Fn;

export type MetroBulkModuleByProperty<T extends any[]> = {
	[K in keyof T]: AnyProps<{
		[P in T[K]['params'][number]]: any
	}>
};

export type MetroBulkModuleByName<T extends any[]> = {
	[K in keyof T]: T[K] extends { interop: false; }
	? { default: Fn; }
	: Fn
};

export type MetroPropertyRecordOrArray<
	T extends any[],
	U extends string
> = T extends MetroBulkFind<U>
	? MetroBulkModuleByProperty<T>
	: MetroSingleModuleByProperty<T>;

export type MetroFunctionSignatureOrArray<
	T extends any[],
	U extends string
> = T extends MetroBulkFind<U>
	? MetroBulkModuleByName<T>
	: MetroSingleModuleByName<T>;

export type MetroModule<TProps extends string> = MetroPropertyRecordOrArray<TProps[], TProps>;

export type MetroFilter = ((mdl: any, id: number | string) => boolean | never) & {
	[CACHE_KEY]: string;
	isRaw?: boolean;
};