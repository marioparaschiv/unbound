import type { Filter } from './filters';

export type InternalOptions = {
	bulk?: boolean;
	lazy?: boolean;
};

export type SearchOptions = {
	esModules?: boolean;
	interop?: boolean;
	initial?: any[];
	cache?: boolean;
	lazy?: boolean;
	raw?: boolean;
	all?: boolean;
};

export interface StoreOptions extends SearchOptions {
	short?: boolean;
}

export interface BulkItem extends Omit<SearchOptions, 'all' | 'initial' | 'cache'> {
	filter: Filter;
}

export type StringFindWithOptions<T extends string> = [...T[], Record<string, boolean>];
export type BulkFind<T extends string> = [...({ params: T[], [k: string]: any })[], { bulk: true }];

export type PropertyRecordOrArray<
    T extends any[], 
    U extends string
> = T extends BulkFind<U>
    ? { [K in keyof T]: AnyProps<{ [P in T[K]["params"][number]]: any }> }
    : T extends [...any, infer Options extends Record<string, any>]
        ? AllValues<Options, AnyProps<{ [k in Exclude<T[number], Record<string, any>>]: any }>>
        : AnyProps<{ [k in Exclude<T[number], Record<string, any>>]: any }>

export type FunctionSignatureOrArray<T extends any[], U extends string> = T extends BulkFind<U>
    ? { [K in keyof T]: T[K] extends { interop: false }
        ? { default: AllValues<T[K], Fn> }
        : AllValues<T[K], Fn> }
    : T extends [...any, infer Options extends Record<string, any>]
        ? Options extends { interop: false }
            ? AllValues<Options, ({ default: Fn })>
            : AllValues<Options, Fn>
        : Fn

export type AllValues<T extends Record<string, any>, U extends unknown> = T extends { all: true } ? U[] : U