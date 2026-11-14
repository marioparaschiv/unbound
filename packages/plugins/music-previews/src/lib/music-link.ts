export type MusicLink =
	| { service: 'spotify'; kind: 'track' | 'album' | 'playlist'; id: string }
	| { service: 'apple'; kind: 'song' | 'album'; id: string; country: string };

const SPOTIFY =
	/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist)\/([A-Za-z0-9]{22})(?:[/?#]|$)/i;
const APPLE =
	/^https?:\/\/(?:geo\.)?(?:music|itunes)\.apple\.com\/([a-z]{2})\/(album|song)\/(?:[^/?#]+\/)?(?:id)?(\d+)(?:[/?#]|$)/i;
const APPLE_SONG = /[?&]i=(\d+)/;

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
 * @description Reads a Spotify song, album or playlist link, or an Apple Music song or album link.
 * @param href The link.
 * @returns What it points to, or `undefined` for any other link.
 */
export function parseMusicLink(href: string): MusicLink | undefined {
	return spotifyLink(href) ?? appleLink(href);
}
