import { GIPHY_KEY, GIPHY_PAGE_SIZE, SUGGESTION_LIMIT } from '~/constants';
import type { DiscordGif, GifProvider, ProviderContext, TrendingData } from '~/types';
import { buildUrl, type FetchJson } from '~/providers/fetch-json';
import { pickGiphyFormat } from '~/providers/formats';
import { toGiphyLanguage } from '~/providers/locale';

type GiphyImage = {
	url?: string;
	width?: string;
	height?: string;
	mp4?: string;
	webp?: string;
};

export type GiphyResult = {
	id: string;
	title?: string;
	url?: string;
	images?: Record<string, GiphyImage | undefined>;
};

type GiphyCategories = {
	data?: { name?: string; gif?: GiphyResult }[];
};

/**
 * @description Turns a Giphy result into the GIF object Discord's picker renders.
 * @param item The Giphy result.
 * @param mediaFormat The `media_format` Discord asked for.
 * @returns The GIF, or `null` when Giphy sent no original or no rendition in that format.
 */
export function giphyToDiscordGif(item: GiphyResult, mediaFormat: string): DiscordGif | null {
	const original = item.images?.original;
	const fixed = item.images?.fixed_height;
	const src = fixed?.[pickGiphyFormat(mediaFormat)];

	if (!original?.url || !fixed || !src || !item.url) return null;

	return {
		id: item.id,
		title: item.title ?? '',
		url: item.url,
		gif_src: original.url,
		src,
		width: Number(fixed.width) || 0,
		height: Number(fixed.height) || 0,
		preview: item.images?.fixed_height_still?.url ?? original.url,
	};
}

/**
 * @description Splits a result count into Giphy's offset pages of at most 50.
 * @param limit How many results to fetch.
 * @returns Each page's `offset` and `limit`.
 */
export function giphyPages(limit: number): { offset: number; limit: number }[] {
	return Array.from({ length: Math.ceil(limit / GIPHY_PAGE_SIZE) }, (_, index) => {
		const offset = index * GIPHY_PAGE_SIZE;

		return { offset, limit: Math.min(GIPHY_PAGE_SIZE, limit - offset) };
	});
}

/**
 * @description Merges Giphy pages, dropping results that shifted onto two pages.
 * @param pages The results of each page, in order.
 * @param limit How many results to keep.
 * @returns At most `limit` unique results.
 */
export function mergeGiphyPages(pages: GiphyResult[][], limit: number): GiphyResult[] {
	const unique = new Map(pages.flat().map((item) => [item.id, item]));

	return [...unique.values()].slice(0, limit);
}

/**
 * @description Turns Giphy's categories into Discord's trending categories.
 * @param response Giphy's `/gifs/categories` response.
 * @returns The categories with the first one's image as the trending preview, or `null` when there are none.
 */
export function giphyToTrending(response: GiphyCategories | null): TrendingData | null {
	const categories = (response?.data ?? []).flatMap((category) => {
		const src = category.gif?.images?.fixed_height?.url;

		return category.name && src ? [{ name: category.name, src }] : [];
	});
	const [first] = categories;

	return first ? { categories, gifs: [{ src: first.src }] } : null;
}

/**
 * @description Creates the Giphy provider, which uses Giphy's v1 API.
 * @param fetchJson Fetches and parses a URL.
 * @returns The provider.
 */
export function createGiphyProvider(fetchJson: FetchJson): GifProvider {
	function request<T>(path: string, context: ProviderContext, params: Record<string, string>) {
		return fetchJson<T>(
			buildUrl(`https://api.giphy.com/v1${path}`, {
				api_key: GIPHY_KEY,
				lang: toGiphyLanguage(context.locale),
				...params,
			}),
		);
	}

	async function results(
		path: string,
		limit: number,
		context: ProviderContext,
		extra: Record<string, string> = {},
	) {
		const pages = await Promise.all(
			giphyPages(limit).map(async (page) => {
				const response = await request<{ data?: GiphyResult[] }>(path, context, {
					...extra,
					limit: String(page.limit),
					offset: String(page.offset),
				});

				return response.data ?? [];
			}),
		);

		return mergeGiphyPages(pages, limit).flatMap(
			(item) => giphyToDiscordGif(item, context.mediaFormat) ?? [],
		);
	}

	return {
		search: (query, limit, context) => results('/gifs/search', limit, context, { q: query }),
		searchSuggestions: async (query, context) =>
			(
				await request<{ data?: { name: string }[] }>('/gifs/search/tags', context, {
					q: query,
					limit: String(SUGGESTION_LIMIT),
				})
			).data?.map((tag) => tag.name) ?? [],
		getTrending: (limit, context) => results('/gifs/trending', limit, context),
		getCategories: async (context) =>
			giphyToTrending(
				await request<GiphyCategories>('/gifs/categories', context, {}).catch(() => null),
			),
		registerShare: async () => {},
	};
}
