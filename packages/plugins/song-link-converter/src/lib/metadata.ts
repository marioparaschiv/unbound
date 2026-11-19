import type { MusicLink } from '~/lib/links';

export type Fetcher = (url: string) => Promise<{ ok: boolean; text(): Promise<string> }>;

type ItunesResult = { trackName?: string; collectionName?: string; artistName?: string };
type DeezerResult = { title?: string; artist?: { name?: string } };
type OEmbed = { title?: string; author_name?: string };

function metaContent(html: string, property: string): string | undefined {
	const match = new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]*)"`).exec(html);

	return match?.[1]?.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"');
}

function joined(artist: string | undefined, title: string | undefined): string | undefined {
	const parts = [artist, title].map((part) => part?.trim()).filter(Boolean);

	return title?.trim() ? parts.join(' ') : undefined;
}

async function json<T>(fetcher: Fetcher, url: string): Promise<T | undefined> {
	const response = await fetcher(url);

	return response.ok ? (JSON.parse(await response.text()) as T) : undefined;
}

/**
 * @description Reads a music link's artist and title from its own service.
 * @param link The music link.
 * @param fetcher Fetches a URL.
 * @returns The artist and title to search for, or `undefined` when the service didn't say.
 */
export async function searchQuery(link: MusicLink, fetcher: Fetcher): Promise<string | undefined> {
	switch (link.service) {
		case 'spotify': {
			const response = await fetcher(link.url);
			const html = response.ok ? await response.text() : '';
			const artist = metaContent(html, 'og:description')?.split(' · ')[0];

			return joined(artist, metaContent(html, 'og:title'));
		}
		case 'appleMusic': {
			const found = await json<{ results?: ItunesResult[] }>(
				fetcher,
				`https://itunes.apple.com/lookup?id=${link.id}&country=${link.country}`,
			);
			const result = found?.results?.[0];

			return joined(result?.artistName, result?.trackName ?? result?.collectionName);
		}
		case 'youtubeMusic': {
			const found = await json<OEmbed>(
				fetcher,
				`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link.url)}`,
			);

			return joined(found?.author_name?.replace(/ - Topic$/, ''), found?.title);
		}
		case 'deezer': {
			const found = await json<DeezerResult>(
				fetcher,
				`https://api.deezer.com/${link.kind}/${link.id}`,
			);

			return joined(found?.artist?.name, found?.title);
		}
	}
}

export default searchQuery;
