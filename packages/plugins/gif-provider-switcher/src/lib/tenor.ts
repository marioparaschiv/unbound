import { SUGGESTION_LIMIT, TENOR_KEY, TENOR_PAGE_SIZE } from '~/lib/constants';
import type { DiscordGif, GifProvider, ProviderContext, TrendingData } from '~/lib/types';
import { buildUrl, type FetchJson } from '~/lib/fetch-json';
import { pickTenorFormat } from '~/lib/formats';
import { toTenorLocale } from '~/lib/locale';

type TenorMedia = {
	url?: string;
	preview?: string;
	dims?: [number, number];
};

export type TenorResult = {
	id: string;
	title?: string;
	h1_title?: string;
	itemurl?: string;
	media?: Record<string, TenorMedia | undefined>[];
};

type TenorPage = {
	next?: string;
	results?: TenorResult[];
};

type TenorCategories = {
	tags?: { searchterm?: string; image?: string }[];
};

/**
 * @description Turns a Tenor result into the GIF object Discord's picker renders.
 * @param item The Tenor result.
 * @param mediaFormat The `media_format` Discord asked for.
 * @returns The GIF, or `null` when Tenor sent no GIF or no rendition in that format.
 */
export function tenorToDiscordGif(item: TenorResult, mediaFormat: string): DiscordGif | null {
	const media = item.media?.[0];
	const gif = media?.gif;
	const rendition = media?.[pickTenorFormat(mediaFormat)];

	if (!gif?.url || !rendition?.url || !item.itemurl) return null;

	return {
		id: item.id,
		title: item.title || item.h1_title || '',
		url: item.itemurl,
		gif_src: gif.url,
		src: rendition.url,
		width: rendition.dims?.[0] ?? 0,
		height: rendition.dims?.[1] ?? 0,
		preview: rendition.preview ?? gif.preview ?? gif.url,
	};
}

/**
 * @description Collects up to `limit` unique Tenor results, following Tenor's `next` cursor page by page.
 * @param fetchPage Fetches one page from a cursor, which is empty for the first page.
 * @param limit How many results to collect.
 * @returns The results, without duplicates.
 */
export async function collectTenorResults(
	fetchPage: (pos: string, pageLimit: number) => Promise<TenorPage>,
	limit: number,
): Promise<TenorResult[]> {
	const pageSize = Math.min(limit, TENOR_PAGE_SIZE);
	const items: TenorResult[] = [];
	const seen = new Set<string>();
	let pos = '';

	while (items.length < limit) {
		const { next, results = [] } = await fetchPage(
			pos,
			Math.min(limit - items.length, pageSize),
		);
		const before = items.length;

		for (const item of results) {
			if (seen.has(item.id)) continue;

			seen.add(item.id);
			items.push(item);

			if (items.length >= limit) break;
		}

		if (items.length === before || !next || next === pos) break;

		pos = next;
	}

	return items;
}

/**
 * @description Turns Tenor's featured categories into Discord's trending categories.
 * @param response Tenor's `/categories` response.
 * @returns The categories with the first one's image as the trending preview, or `null` when there are none.
 */
export function tenorToTrending(response: TenorCategories | null): TrendingData | null {
	const categories = (response?.tags ?? []).flatMap((tag) =>
		tag.searchterm && tag.image ? [{ name: tag.searchterm, src: tag.image }] : [],
	);
	const [first] = categories;

	return first ? { categories, gifs: [{ src: first.src }] } : null;
}

/**
 * @description Creates the Tenor provider, which uses Tenor's v1 API.
 * @param fetchJson Fetches and parses a URL.
 * @returns The provider.
 */
export function createTenorProvider(fetchJson: FetchJson): GifProvider {
	function request<T>(path: string, context: ProviderContext, params: Record<string, string>) {
		return fetchJson<T>(
			buildUrl(`https://api.tenor.com/v1${path}`, {
				key: TENOR_KEY,
				locale: toTenorLocale(context.locale),
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
		const items = await collectTenorResults(
			(pos, pageLimit) =>
				request<TenorPage>(path, context, { ...extra, limit: String(pageLimit), pos }),
			limit,
		);

		return items.flatMap((item) => tenorToDiscordGif(item, context.mediaFormat) ?? []);
	}

	return {
		search: (query, limit, context) => results('/search', limit, context, { q: query }),
		searchSuggestions: async (query, context) =>
			(
				await request<{ results?: string[] }>('/search_suggestions', context, {
					q: query,
					limit: String(SUGGESTION_LIMIT),
				})
			).results ?? [],
		getTrending: (limit, context) => results('/trending', limit, context),
		getCategories: async (context) =>
			tenorToTrending(
				await request<TenorCategories>('/categories', context, { type: 'featured' }).catch(
					() => null,
				),
			),
		registerShare: async (id, query, context) => {
			await request('/registershare', context, { id, q: query });
		},
	};
}
