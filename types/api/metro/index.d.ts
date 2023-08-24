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