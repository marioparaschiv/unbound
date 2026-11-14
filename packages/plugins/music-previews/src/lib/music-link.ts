export type MusicLink =
	| { service: 'spotify'; kind: 'track' | 'album' | 'playlist'; id: string }
	| { service: 'apple'; kind: 'song' | 'album'; id: string; country: string }
	| { service: 'deezer'; kind: 'track' | 'album' | 'playlist'; id: string }
	| { service: 'tidal'; kind: 'track'; id: string };

const SPOTIFY =
	/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist)\/([A-Za-z0-9]{22})(?:[/?#]|$)/i;
const APPLE =
	/^https?:\/\/(?:geo\.)?(?:music|itunes)\.apple\.com\/([a-z]{2})\/(album|song)\/(?:[^/?#]+\/)?(?:id)?(\d+)(?:[/?#]|$)/i;
const APPLE_SONG = /[?&]i=(\d+)/;
const DEEZER =
	/^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(track|album|playlist)\/(\d+)(?:[/?#]|$)/i;
const TIDAL = /^https?:\/\/(?:listen\.)?tidal\.com\/(?:browse\/)?track\/(\d+)(?:[/?#]|$)/i;

function deezerLink(href: string): MusicLink | undefined {
	const match = DEEZER.exec(href);

	if (!match) return undefined;

	return {
		service: 'deezer',
		kind: match[1]!.toLowerCase() as 'track' | 'album' | 'playlist',
		id: match[2]!,
	};
}

function tidalLink(href: string): MusicLink | undefined {
	const match = TIDAL.exec(href);

	return match ? { service: 'tidal', kind: 'track', id: match[1]! } : undefined;
}

function appleLink(href: string): MusicLink | undefined {
	const match = APPLE.exec(href);

	if (!match) return undefined;

	const country = match[1]!.toLowerCase();
	const song = APPLE_SONG.exec(href)?.[1];

	if (song) return { service: 'apple', kind: 'song', id: song, country };

	return {
		service: 'apple',
		kind: match[2]!.toLowerCase() as 'song' | 'album',
		id: match[3]!,
		country,
	};
}

function spotifyLink(href: string): MusicLink | undefined {
	const match = SPOTIFY.exec(href);

	if (!match) return undefined;

	return {
		service: 'spotify',
		kind: match[1]!.toLowerCase() as 'track' | 'album' | 'playlist',
		id: match[2]!,
	};
}

/**
 * @description Reads a Spotify or Deezer song, album or playlist link, an Apple Music song or album link, or a Tidal song link.
 * @param href The link.
 * @returns What it points to, or `undefined` for any other link.
 */
export function parseMusicLink(href: string): MusicLink | undefined {
	return spotifyLink(href) ?? appleLink(href) ?? deezerLink(href) ?? tidalLink(href);
}
