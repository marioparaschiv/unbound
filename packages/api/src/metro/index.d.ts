export declare const CACHE_KEY: unique symbol;
export declare const data: {
	cache: Map<any, any>;
	importingModuleId: number;
	patchedNativeRequire: boolean;
	patchedRTNProfiler: boolean;
	patchedImportTracker: boolean;
	origToString: () => string;
	listeners: Set<(mdl: any, id: string) => void>;
};
export declare const off: typeof removeListener;
export declare const on: typeof addListener;
export declare function addListener(listener: (mdl: any, id: string) => void): () => boolean;
export declare function bulk(...items: MetroBulkItem[]): any[];
export declare function find(filter: MetroFilter, options?: MetroSearchOptions): any;
export declare function findByFilePath<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): AnyProps;
export declare function findByName<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): MetroFunctionSignatureOrArray<T, U>;
export declare function findByProps<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): MetroPropertyRecordOrArray<T, U> & {};
export declare function findByPrototypes<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): AnyProps;
export declare function findLazy(
	filter: MetroFilter,
	options?: Omit<MetroSearchOptions, 'lazy' | 'all'>,
): any;
export declare function findStore<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U, MetroStoreOptions>,
>(...args: T): AnyProps;
export declare function initializeModule(id: number): boolean;
export declare function removeListener(listener: (mdl: any, id: string) => void): void;
export interface MetroBulkItem extends Omit<MetroSearchOptions, 'initial' | 'cache'> {
	filter: MetroFilter;
}
export interface MetroStoreOptions extends MetroSearchOptions {
	short?: boolean;
}
export type MetroAllValues<T extends Record<PropertyKey, any>, U extends unknown> = T extends {
	all: true;
}
	? U[]
	: U;
export type MetroBulkFind<T extends string> = [
	...AnyProps<{
		params: T[];
	}>[],
	AnyProps<{
		bulk: true;
	}>,
];
export type MetroBulkModuleByName<T extends any[]> = {
	[K in keyof T]: T[K] extends {
		interop: false;
	}
		? {
				default: Fn;
			}
		: Fn;
};
export type MetroBulkModuleByProperty<T extends any[]> = {
	[K in keyof T]: AnyProps<{
		[P in T[K]['params'][number]]: any;
	}>;
};
export type MetroFunctionSignatureOrArray<T extends any[], U extends string> =
	T extends MetroBulkFind<U> ? MetroBulkModuleByName<T> : MetroSingleModuleByName<T>;
export type MetroInternalOptions = {
	bulk?: boolean;
	lazy?: boolean;
};
export type MetroModule<TProps extends string> = MetroPropertyRecordOrArray<TProps[], TProps>;
export type MetroPropertyRecordOrArray<T extends any[], U extends string> =
	T extends MetroBulkFind<U> ? MetroBulkModuleByProperty<T> : MetroSingleModuleByProperty<T>;
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
export type MetroSingleModuleByName<T extends any[]> = T extends [
	...any,
	infer O extends MetroSearchOptions,
]
	? MetroAllValues<
			O,
			O extends {
				interop: false;
			}
				? {
						default: Fn;
					}
				: Fn
		>
	: Fn;
export type MetroSingleModuleByProperty<T extends any[]> = T extends [
	...any,
	infer O extends MetroSearchOptions,
]
	? MetroAllValues<
			O,
			AnyProps<{
				[k in Exclude<T[number], Record<PropertyKey, any>>]: any;
			}>
		>
	: AnyProps<{
			[k in Exclude<T[number], Record<PropertyKey, any>>]: any;
		}>;
export type MetroStringFindWithOptions<T extends string, Options = MetroSearchOptions> = [
	...T[],
	Options,
];
type AnyProps<T extends Record<PropertyKey, any> = Record<PropertyKey, any>> = T &
	Record<PropertyKey, any>;
type Fn<T = any> = (...args: any) => T;
type MetroFilter = ((mdl: any, id: number | string) => boolean | never) & {
	[CACHE_KEY]: string;
	isRaw?: boolean;
};

export * as filters from './filters';


