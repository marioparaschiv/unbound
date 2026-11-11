import { flux, metro, patcher } from '@unbound-app/api';

import { answerRoute, PASS_THROUGH, toErrorResponse, toResponse } from '~/lib/handlers';
import { matchGifRoute, resolveContext, type HttpMethod } from '~/lib/routes';
import { getSelectedProvider, onProviderChange } from '~/lib/selected';
import { isReplacement } from '~/lib/selection';
import { getProvider } from '~/lib/providers';
import type { ProviderContext, ProviderId, TrendingData } from '~/lib/types';

type RestMethod = (request: unknown) => Promise<unknown>;

type RestClient = {
	get: RestMethod;
	post: RestMethod;
	HTTP?: Pick<RestClient, 'get' | 'post'>;
};

const LocaleStore = flux.getStore('Locale') as { locale?: string };

const trending = new Map<ProviderId, TrendingData>();
let lastContext: Partial<ProviderContext> = {};

function contextFor(context: Partial<ProviderContext>): ProviderContext {
	lastContext = { ...lastContext, ...context };

	return resolveContext(lastContext, { locale: LocaleStore.locale });
}

function patchMethod(client: Pick<RestClient, HttpMethod>, method: HttpMethod): void {
	patcher.instead(client, method, ({ args, original, this: self }) => {
		const providerId = getSelectedProvider();
		const matched = isReplacement(providerId) ? matchGifRoute(method, args[0]) : null;

		if (!matched || !isReplacement(providerId)) return original.apply(self, args);

		const context = contextFor(matched.context);

		return answerRoute(matched.route, getProvider(providerId), context, {
			get: () => trending.get(providerId),
			set: (data) => trending.set(providerId, data),
		}).then(
			(body) => (body === PASS_THROUGH ? original.apply(self, args) : toResponse(body)),
			(error: unknown) => Promise.reject(toErrorResponse(error)),
		);
	});
}

async function refreshTrending(REST: RestClient): Promise<void> {
	const { locale, mediaFormat } = resolveContext(lastContext, { locale: LocaleStore.locale });

	try {
		const response = (await REST.get({
			url: '/gifs/trending',
			query: { locale, media_format: mediaFormat },
		})) as { body?: Partial<TrendingData> };
		const categories = response.body?.categories;

		if (!Array.isArray(categories)) return;

		await flux.dispatch({
			type: 'GIF_PICKER_TRENDING_FETCH_SUCCESS',
			trendingCategories: categories,
			trendingGIFPreview: response.body?.gifs?.[0],
		});
	} catch (error) {
		logger.warn('Could not refresh trending categories:', error);
	}
}

/**
 * @description Serves the GIF picker and GIF search from the provider the user picked, in place of Discord's Klipy results.
 * Patches `get` and `post` on Discord's HTTP client (`metro.common.REST`, found by `getAPIBaseURL`) and on its `HTTP` object, which the mobile GIF picker calls, and answers `/gifs/search`, `/gifs/suggest`, `/gifs/trending`, `/gifs/trending-gifs`, `/integrations/<id>/search` and `POST /gifs/select` itself, with the bodies those endpoints send.
 * Discord's GIF picker actions then dispatch `GIF_PICKER_QUERY_SUCCESS`, `GIF_PICKER_SUGGESTIONS_SUCCESS`, `GIF_PICKER_TRENDING_FETCH_SUCCESS` and `INTEGRATION_QUERY_SUCCESS` as usual.
 * With Klipy picked, every request goes to Discord unchanged.
 * When the provider changes, the cached categories are dropped and `GIF_PICKER_TRENDING_FETCH_SUCCESS` is dispatched with the new provider's; {@link restoreTrending} does the same with Klipy's.
 * Reads the locale from each request, else `LocaleStore`.
 */
export function patchRest(): void {
	const REST: RestClient | undefined = metro.common.REST;

	if (!REST) {
		logger.warn('GIF requests skipped: Discord moved REST.');

		return;
	}

	for (const client of REST.HTTP ? [REST, REST.HTTP] : [REST]) {
		patchMethod(client, 'get');
		patchMethod(client, 'post');
	}

	onProviderChange(() => {
		trending.clear();
		void refreshTrending(REST);
	});
}

/**
 * @description Asks Discord for Klipy's trending categories again when the picked provider served them, and forgets the
 * request context. Call it after `patcher.unpatchAll()`, or the refresh would be answered by the provider.
 */
export function restoreTrending(): void {
	const REST: RestClient | undefined = metro.common.REST;
	const servedTrending = trending.size > 0;

	trending.clear();

	if (servedTrending && REST) void refreshTrending(REST);

	lastContext = {};
}
