import type { MusicCollection, PreviewTrack } from '~/lib/collection';

type Json = Record<string, unknown>;

const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;

const isObject = (value: unknown): value is Json =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function child(value: unknown, ...path: string[]): unknown {
	let current = value;

	for (const key of path) {
		if (!isObject(current)) return undefined;

		current = current[key];
	}

	return current;
}

function artists(entity: Json): string {
	const list = entity.artists;

	if (!Array.isArray(list)) return text(entity.subtitle);

	return list
		.map((artist) => text(child(artist, 'name')))
		.filter(Boolean)
		.join(', ');
}

function previewOf(entity: unknown): string | undefined {
	const url = text(child(entity, 'audioPreview', 'url'));

	return url.startsWith('https://') ? url : undefined;
}

function coverOf(entity: Json): string | undefined {
	const images = child(entity, 'visualIdentity', 'image');
	const first = Array.isArray(images) ? text(child(images[0], 'url')) : '';

	return first || undefined;
}

function trackOf(entry: unknown): PreviewTrack | undefined {
	const title = text(child(entry, 'title'));

	if (!title) return undefined;

	return {
		title,
		subtitle: text(child(entry, 'subtitle')).replace(/ /g, ' '),
		preview: previewOf(entry),
	};
}

/**
 * @description Reads the title, cover and preview clips from a Spotify embed page.
 * @param html The embed page.
 * @returns The song, album or playlist, or `undefined` when the page has no data Spotify still ships this way.
 */
export function parseEmbed(html: string): MusicCollection | undefined {
	const data = NEXT_DATA.exec(html)?.[1];

	if (!data) return undefined;

	let parsed: unknown;

	try {
		parsed = JSON.parse(data);
	} catch {
		return undefined;
	}

	const entity = child(parsed, 'props', 'pageProps', 'state', 'data', 'entity');

	if (!isObject(entity)) return undefined;

	const title = text(entity.name) || text(entity.title);
	const list = entity.trackList;
	const tracks = Array.isArray(list)
		? list.map(trackOf).filter((track): track is PreviewTrack => track !== undefined)
		: [{ title, subtitle: artists(entity), preview: previewOf(entity) }];

	return { title, subtitle: artists(entity), cover: coverOf(entity), tracks };
}

/**
 * @description Builds the URL of Spotify's embed page, which carries the titles and Spotify's own preview clips.
 * @param kind A song, album or playlist.
 * @param id Its Spotify id.
 * @returns The embed page URL.
 */
export function embedUrl(kind: string, id: string): string {
	return `https://open.spotify.com/embed/${kind}/${id}`;
}
