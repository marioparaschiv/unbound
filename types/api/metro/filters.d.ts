import type { CACHE_KEY } from '@constants';


export type Filter = ((mdl: any, id: number | string) => boolean | never) & {
	[CACHE_KEY]: string;
	isRaw?: boolean;
};