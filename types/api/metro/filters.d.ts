import type { METRO_CACHE_KEY } from '@constants';

export type Filter = ((mdl: any, id: number | string) => boolean | never);

export interface FilterWithCacheKey extends Filter {
	[METRO_CACHE_KEY]: string;
}