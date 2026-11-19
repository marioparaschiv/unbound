export type Service = 'spotify' | 'appleMusic' | 'youtubeMusic' | 'deezer' | 'tidal';

export type MusicLink =
	| { service: 'spotify'; url: string }
	| { service: 'appleMusic'; id: string; country: string }
	| { service: 'youtubeMusic'; url: string }
	| { service: 'deezer'; kind: 'track' | 'album'; id: string };

const SPOTIFY = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:track|album)\/[A-Za-z0-9]+/;
const APPLE =
	/^https:\/\/music\.apple\.com\/([a-z]{2})\/(?:album|song)\/[^/?#]+\/(\d+)(?:\?(?:[^#]*&)?i=(\d+))?/;
const YOUTUBE_MUSIC = /^https:\/\/music\.youtube\.com\/(?:watch\?v=|playlist\?list=)[\w-]+/;
const DEEZER = /^https:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?(track|album)\/(\d+)/;

/**
 * @description Reads which music service a link belongs to and what it points at.
 * @param url The tapped link.
 * @returns The music link, or `undefined` for any other link.
 */
export function readMusicLink(url: string): MusicLink | undefined {
	const spotify = SPOTIFY.exec(url);

	if (spotify) return { service: 'spotify', url: spotify[0] };

	const apple = APPLE.exec(url);

	if (apple) return { service: 'appleMusic', country: apple[1]!, id: apple[3] ?? apple[2]! };

	const youtube = YOUTUBE_MUSIC.exec(url);

	if (youtube) return { service: 'youtubeMusic', url: youtube[0] };

	const deezer = DEEZER.exec(url);

	if (deezer) return { service: 'deezer', kind: deezer[1] as 'track' | 'album', id: deezer[2]! };

	return undefined;
}

const SEARCHES: Record<Service, (query: string) => string> = {
	spotify: (query) => `https://open.spotify.com/search/${query}`,
	appleMusic: (query) => `https://music.apple.com/search?term=${query}`,
	youtubeMusic: (query) => `https://music.youtube.com/search?q=${query}`,
	deezer: (query) => `https://www.deezer.com/search/${query}`,
	tidal: (query) => `https://tidal.com/search?q=${query}`,
};

/**
 * @description Builds the link that searches a music service for a song or album.
 * @param service The service to search.
 * @param query What to search for, such as the artist and title.
 * @returns The search link.
 */
export function searchLink(service: Service, query: string): string {
	return SEARCHES[service](encodeURIComponent(query));
}

export default { readMusicLink, searchLink };
