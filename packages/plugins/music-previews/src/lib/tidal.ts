import { type MusicCollection, withSearches } from '~/lib/collection';

const META = /<meta property="og:(title|image)" content="([^"]*)"/g;
const SEPARATOR = ' - ';

function decode(value: string): string {
	return value
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&amp;', '&');
}

/**
 * @description Builds the sheet's song from a Tidal track page, whose Open Graph title reads "Artist - Title". Tidal
 * has no clips without signing in, so the song gets an iTunes search.
 * @param html The track page.
 * @returns The song, or `undefined` when the page names none.
 */
export function tidalCollection(html: string): MusicCollection | undefined {
	const meta = new Map([...html.matchAll(META)].map((match) => [match[1]!, decode(match[2]!)]));
	const heading = meta.get('title') ?? '';
	const split = heading.indexOf(SEPARATOR);

	if (split <= 0 || heading.endsWith('TIDAL')) return undefined;

	const artist = heading.slice(0, split);
	const title = heading.slice(split + SEPARATOR.length);
	const image = meta.get('image');

	return {
		title,
		subtitle: artist,
		cover: image?.startsWith('https://') ? image : undefined,
		tracks: withSearches([{ title, subtitle: artist }]),
	};
}

/**
 * @description Loads a Tidal song from its public track page.
 * @param id The track's Tidal id.
 * @returns The song, or `undefined` when Tidal had nothing.
 */
export async function loadTidal(id: string): Promise<MusicCollection | undefined> {
	const response = await fetch(`https://tidal.com/browse/track/${id}`);

	return response.ok ? tidalCollection(await response.text()) : undefined;
}

export default loadTidal;
