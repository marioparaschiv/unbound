import { LASTFM_API_KEY } from '~/lib/constants';
import type { Fetcher, Scrobbler, TrackData } from '~/lib/types';
import type { Preferences } from '~/lib/constants';

type LastFmText = { '#text'?: string };

type LastFmTrack = {
	name?: string;
	url?: string;
	album?: LastFmText;
	artist?: LastFmText;
	image?: (LastFmText & { size?: string })[];
	'@attr'?: { nowplaying?: string | boolean };
};

type LastFmResponse = {
	error?: number;
	message?: string;
	recenttracks?: { track?: LastFmTrack[] | LastFmTrack };
};

const site = (path: string) => `https://www.last.fm${path}`;

/**
 * @description Builds the Last.fm API URL that returns a user's most recent scrobble.
 * @param preferences The current preferences, for the username and optional API key.
 * @returns The `user.getrecenttracks` request URL.
 */
export function recentTracksUrl(preferences: Preferences): string {
	const params = new URLSearchParams({
		method: 'user.getrecenttracks',
		api_key: preferences.apiKey || LASTFM_API_KEY,
		user: preferences.username,
		limit: '1',
		format: 'json',
	});

	return `https://ws.audioscrobbler.com/2.0/?${params}`;
}

/**
 * @description Reads the now-playing track out of a Last.fm `user.getrecenttracks` response.
 * @param json The parsed response body.
 * @returns The track, or `null` when nothing is playing right now.
 * @throws When the response is a Last.fm API error.
 */
export function parseRecentTracks(json: unknown): TrackData | null {
	const response = (json ?? {}) as LastFmResponse;

	if (response.error) throw new Error(`Last.fm error ${response.error}: ${response.message}`);

	const tracks = response.recenttracks?.track;
	const track = Array.isArray(tracks) ? tracks[0] : tracks;

	if (!track?.['@attr']?.nowplaying) return null;

	const artist = track.artist?.['#text'] ?? '';
	const album = track.album?.['#text'] ?? '';

	return {
		name: track.name || 'Unknown',
		album,
		artist: artist || 'Unknown',
		trackURL: track.url,
		artistURL: artist ? site(`/music/${encodeURIComponent(artist)}`) : undefined,
		albumURL: site(`/music/${encodeURIComponent(artist)}/${encodeURIComponent(album)}`),
		imageURL: track.image?.find((image) => image.size === 'large')?.['#text'] || undefined,
	};
}

export const LastFmScrobbler: Scrobbler = {
	name: 'Last.fm',
	id: 'lastfm',

	async fetchTrackData(preferences: Preferences, fetcher: Fetcher) {
		const response = await fetcher(recentTracksUrl(preferences));

		if (!response.ok)
			throw new Error(`Last.fm returned ${response.status} ${response.statusText}`);

		return parseRecentTracks(await response.json());
	},

	userUrl(_preferences: Preferences, username: string) {
		return site(`/user/${encodeURIComponent(username)}`);
	},
};
