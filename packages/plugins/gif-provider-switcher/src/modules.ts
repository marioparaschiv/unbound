import createRunningFlag from '@unbound-plugins/shared/react/running-flag';
import { flux, metro } from '@unbound-app/api';

type RestMethod = (request: unknown) => Promise<unknown>;

export type RestClient = {
	get: RestMethod;
	post: RestMethod;
	HTTP?: Pick<RestClient, 'get' | 'post'>;
};

export type GifPickerViewStoreType = {
	getQuery?: () => unknown;
};

export const REST: RestClient = metro.common.REST;

export const LocaleStore = flux.getStore('Locale', { lazy: true }) as { locale?: string };

export const GIFPickerViewStore = flux.getStore('GIFPickerView', {
	lazy: true,
}) as GifPickerViewStoreType;

export const PickerRunning = createRunningFlag(addon.id);
