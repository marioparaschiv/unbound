import type { MusicCollection, PreviewTrack } from '~/lib/collection';

type Json = Record<string, unknown>;

type ItunesItem = {
	wrapperType: string;
	trackName: string;
	collectionName: string;
	artistName: string;
	previewUrl?: string;
	artworkUrl100?: string;
};

const ARTWORK_SIZE = '300x300';

const isObject = (value: unknown): value is Json =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function itemOf(value: unknown): ItunesItem | undefined {
	if (!isObject(value)) return undefined;

	const previewUrl = text(value.previewUrl);
	const artworkUrl100 = text(value.artworkUrl100);

	return {
		wrapperType: text(value.wrapperType),
		trackName: text(value.trackName),
		collectionName: text(value.collectionName),
		artistName: text(value.artistName),
		previewUrl: previewUrl.startsWith('https://') ? previewUrl : undefined,
		artworkUrl100: artworkUrl100.startsWith('https://') ? artworkUrl100 : undefined,
	};
}

/**
 * @description Reads the results of an iTunes search or lookup.
 * @param body The response, parsed from JSON.
 * @returns The songs and albums it lists.
 */
export function parseResults(body: unknown): ItunesItem[] {
	const results = isObject(body) ? body.results : undefined;

	if (!Array.isArray(results)) return [];

	return results.map(itemOf).filter((item): item is ItunesItem => item !== undefined);
}

const trackOf = (item: ItunesItem): PreviewTrack => ({
	title: item.trackName,
	subtitle: item.artistName,
	preview: item.previewUrl,
});

/**
 * @description Builds the sheet's song or album from an iTunes lookup.
 * @param items The lookup's results: an album first and its songs, or a single song.
 * @returns The song or album, or `undefined` when the lookup found nothing.
 */
export function collectionOf(items: readonly ItunesItem[]): MusicCollection | undefined {
	const songs = items.filter((item) => item.wrapperType === 'track' && item.trackName);
	const album = items.find((item) => item.wrapperType === 'collection');
	const first = album ?? songs[0];

	if (!first) return undefined;

	return {
		title: album ? album.collectionName : first.trackName,
		subtitle: first.artistName,
		cover: first.artworkUrl100?.replace('100x100', ARTWORK_SIZE),
		tracks: songs.map(trackOf),
	};
}

function score(item: ItunesItem, words: readonly string[]): number {
	const title = item.trackName.toLowerCase();
	const artist = item.artistName.toLowerCase();

	return words.reduce(
		(total, word) =>
			total + (title.includes(word) ? 100 : 0) + (artist.includes(word) ? 80 : 0),
		item.previewUrl ? 10 : 0,
	);
}

/**
 * @description Picks the search result that best matches a song's title and artist and has a clip, as TrackDuel does.
 * @param items The search results.
 * @param query The title and artist searched for.
 * @returns The clip, or `undefined` when no result has one.
 */
export function bestPreview(items: readonly ItunesItem[], query: string): string | undefined {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	const withClips = items.filter((item) => item.previewUrl);

	return [...withClips].sort((a, b) => score(b, words) - score(a, words))[0]?.previewUrl;
}

/**
 * @description Looks up an Apple Music song or album on iTunes.
 * @param id The song or album id.
 * @param country The store's country.
 * @returns The song or album, or `undefined` when iTunes has no such id.
 */
export async function lookupCollection(
	id: string,
	country: string,
): Promise<MusicCollection | undefined> {
	const query = new URLSearchParams({ id, entity: 'song', country });
	const response = await fetch(`https://itunes.apple.com/lookup?${query}`);

	return response.ok ? collectionOf(parseResults(await response.json())) : undefined;
}

/**
 * @description Searches iTunes for a song's clip.
 * @param search The song's title and artist.
 * @returns The clip, or `undefined` when iTunes has none.
 */
export async function searchPreview(search: string): Promise<string | undefined> {
	const query = new URLSearchParams({
		term: search,
		media: 'music',
		entity: 'song',
		limit: '10',
	});
	const response = await fetch(`https://itunes.apple.com/search?${query}`);

	return response.ok ? bestPreview(parseResults(await response.json()), search) : undefined;
}
