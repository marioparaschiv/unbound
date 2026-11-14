import { type MusicCollection, type PreviewTrack, withSearches } from '~/lib/collection';

type Json = Record<string, unknown>;

const API = 'https://api.deezer.com';

const isObject = (value: unknown): value is Json =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const secure = (value: unknown): string | undefined => {
	const url = text(value);

	return url.startsWith('https://') ? url : undefined;
};

const nameOf = (value: unknown): string => (isObject(value) ? text(value.name) : '');

function trackOf(value: unknown): PreviewTrack | undefined {
	if (!isObject(value) || !text(value.title)) return undefined;

	return {
		title: text(value.title),
		subtitle: nameOf(value.artist),
		preview: secure(value.preview),
	};
}

/**
 * @description Builds the sheet's song, album or playlist from a Deezer API response.
 * @param body The response, parsed from JSON.
 * @returns What the sheet shows, or `undefined` for an error or an empty response.
 */
export function deezerCollection(body: unknown): MusicCollection | undefined {
	if (!isObject(body) || 'error' in body || !text(body.title)) return undefined;

	const listed =
		isObject(body.tracks) && Array.isArray(body.tracks.data) ? body.tracks.data : [body];
	const tracks = listed
		.map(trackOf)
		.filter((track): track is PreviewTrack => track !== undefined);
	const album = isObject(body.album) ? body.album : undefined;

	return {
		title: text(body.title),
		subtitle: nameOf(body.artist) || nameOf(body.creator),
		cover: secure(body.cover_xl) ?? secure(body.picture_xl) ?? secure(album?.cover_xl),
		tracks: withSearches(tracks),
	};
}

/**
 * @description Loads a Deezer song, album or playlist from Deezer's public API.
 * @param kind What the link points to.
 * @param id Its Deezer id.
 * @returns What the sheet shows, or `undefined` when Deezer had nothing.
 */
export async function loadDeezer(kind: string, id: string): Promise<MusicCollection | undefined> {
	const response = await fetch(`${API}/${kind}/${id}`);

	return response.ok ? deezerCollection(await response.json()) : undefined;
}

export default loadDeezer;
