import { flux, patcher } from '@unbound-app/api';

import { answerRoute, PASS_THROUGH, toErrorResponse, toResponse } from '~/requests/handlers';
import { matchGifRoute, resolveContext, type HttpMethod } from '~/requests/routes';
import { getSelectedProvider, onProviderChange } from '~/providers/selected';
import { isReplacement } from '~/providers/selection';
import { LocaleStore, REST, type RestClient } from '~/requests/modules';
import { getProvider } from '~/providers';
import type { ProviderContext, ProviderId, TrendingData } from '~/types';

const trending = new Map<ProviderId, TrendingData>();
let lastContext: Partial<ProviderContext> = {};

function contextFor(context: Partial<ProviderContext>): ProviderContext {
	lastContext = { ...lastContext, ...context };

	return resolveContext(lastContext, { locale: LocaleStore.locale });
}

function patchMethod(client: Pick<RestClient, HttpMethod>, method: HttpMethod): () => void {
	return patcher.instead(client, method, ({ args, original, this: self }) => {
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

async function refreshTrending(): Promise<void> {
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
 * When the provider changes, the cached categories are dropped and `GIF_PICKER_TRENDING_FETCH_SUCCESS` is dispatched with the new provider's; stopping does the same with Klipy's.
 * Reads the locale from each request, else `LocaleStore`.
 * @returns A function that stops serving GIFs from the picked provider and asks Discord for Klipy's trending categories
 * again. The Addon scope would remove the patches only after it runs, so it removes them first, or the refresh would be answered by the provider.
 */
export function startRequests(): () => void {
	const clients = REST.HTTP ? [REST, REST.HTTP] : [REST];
	const unpatches = clients.flatMap((client) => [
		patchMethod(client, 'get'),
		patchMethod(client, 'post'),
	]);
	const stopListening = onProviderChange(() => {
		trending.clear();
		void refreshTrending();
	});

	return () => {
		const servedTrending = trending.size > 0;

		stopListening();
		for (const unpatch of unpatches) unpatch();
		trending.clear();

		if (servedTrending) void refreshTrending();

		lastContext = {};
	};
}
