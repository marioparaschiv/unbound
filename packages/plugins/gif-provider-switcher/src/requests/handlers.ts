import { INTEGRATION_LIMIT, SEARCH_LIMIT, TRENDING_LIMIT } from '~/constants';
import type { GifProvider, ProviderContext, TrendingData } from '~/types';
import type { GifRoute } from '~/requests/routes';

export const PASS_THROUGH = Symbol('pass-through');

export type TrendingCache = {
	get: () => TrendingData | undefined;
	set: (data: TrendingData) => void;
};

/**
 * @description Answers a GIF route from a provider, with the body Discord's endpoint would have sent.
 * Search, trending GIFs and integration search answer an array of GIFs, suggestions an array of strings, trending `{ categories, gifs }`, and a GIF select nothing.
 * @param route The GIF route Discord requested.
 * @param provider The provider to ask.
 * @param context The locale and media format Discord asked for.
 * @param cache Holds the provider's trending categories between requests.
 * @returns The response body, or `PASS_THROUGH` when Discord's own request should run instead.
 */
export async function answerRoute(
	route: GifRoute,
	provider: GifProvider,
	context: ProviderContext,
	cache: TrendingCache,
): Promise<unknown> {
	switch (route.kind) {
		case 'search':
			return provider.search(route.query, route.limit ?? SEARCH_LIMIT, context);
		case 'integration':
			return provider.search(route.query, route.limit ?? INTEGRATION_LIMIT, context);
		case 'suggest':
			return provider.searchSuggestions(route.query, context);
		case 'trending-gifs':
			return provider.getTrending(route.limit ?? TRENDING_LIMIT, context);
		case 'select':
			void provider.registerShare(route.id, route.query, context).catch(() => {});

			return null;
		case 'trending': {
			const cached = cache.get();

			if (cached) return cached;

			const data = await provider.getCategories(context);

			if (!data) return PASS_THROUGH;

			cache.set(data);

			return data;
		}
	}
}

/**
 * @description Wraps a body in the response object Discord's HTTP client resolves with.
 * @param body The response body.
 * @returns A successful response.
 */
export function toResponse(body: unknown) {
	return {
		ok: true,
		status: body === null ? 204 : 200,
		headers: {},
		body,
		text: body === null ? '' : JSON.stringify(body),
	};
}

/**
 * @description Builds the error Discord's HTTP client rejects with, so the GIF picker shows its failure state.
 * @param error What the provider threw.
 * @returns A failed response.
 */
export function toErrorResponse(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);

	return { ok: false, status: 502, headers: {}, body: { message }, text: message };
}
