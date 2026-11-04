import { flux, metro } from '@unbound-app/api';

type RestMethod = (request: unknown) => Promise<unknown>;

export type RestClient = {
	get: RestMethod;
	post: RestMethod;
	HTTP?: Pick<RestClient, 'get' | 'post'>;
};

export const REST: RestClient = metro.common.REST;

export const LocaleStore = flux.getStore('Locale') as { locale?: string };
