import { describe, expect, test } from 'bun:test';

import { LASTFM_API_KEY, SETTINGS } from '~/constants';
import { LastFmScrobbler, parseRecentTracks, recentTracksUrl } from '~/scrobblers/lastfm';
import type { Fetcher } from '~/types';

const preferences = { ...SETTINGS, username: 'rini' };

const nowPlaying = {
	recenttracks: {
		track: [
			{
				name: 'Song',
				url: 'https://www.last.fm/music/A+B/_/Song',
				artist: { '#text': 'A B' },
				album: { '#text': 'Al/bum' },
				image: [
					{ size: 'small', '#text': 'https://img/s.png' },
					{ size: 'large', '#text': 'https://img/l.png' },
				],
				'@attr': { nowplaying: 'true' },
			},
		],
	},
};

describe('recentTracksUrl', () => {
	test('uses the shared key unless the user has one', () => {
		const shared = new URL(recentTracksUrl(preferences));

		expect(shared.origin).toBe('https://ws.audioscrobbler.com');
		expect(shared.searchParams.get('method')).toBe('user.getrecenttracks');
		expect(shared.searchParams.get('api_key')).toBe(LASTFM_API_KEY);
		expect(shared.searchParams.get('user')).toBe('rini');
		expect(shared.searchParams.get('limit')).toBe('1');
		expect(shared.searchParams.get('format')).toBe('json');

		const own = new URL(recentTracksUrl({ ...preferences, apiKey: 'mine' }));

		expect(own.searchParams.get('api_key')).toBe('mine');
	});
});

describe('parseRecentTracks', () => {
	test('reads the now-playing track and builds links', () => {
		expect(parseRecentTracks(nowPlaying)).toEqual({
			name: 'Song',
			album: 'Al/bum',
			artist: 'A B',
			trackURL: 'https://www.last.fm/music/A+B/_/Song',
			artistURL: 'https://www.last.fm/music/A%20B',
			albumURL: 'https://www.last.fm/music/A%20B/Al%2Fbum',
			imageURL: 'https://img/l.png',
		});
	});

	test('returns null when the last scrobble is not playing', () => {
		const track = { ...nowPlaying.recenttracks.track[0], '@attr': undefined };

		expect(parseRecentTracks({ recenttracks: { track: [track] } })).toBeNull();
		expect(parseRecentTracks({ recenttracks: { track: [] } })).toBeNull();
		expect(parseRecentTracks(null)).toBeNull();
	});

	test('accepts a single track object', () => {
		expect(
			parseRecentTracks({ recenttracks: { track: nowPlaying.recenttracks.track[0] } })?.name,
		).toBe('Song');
	});

	test('falls back to Unknown for missing names', () => {
		const track = parseRecentTracks({
			recenttracks: { track: [{ '@attr': { nowplaying: 'true' } }] },
		});

		expect(track?.name).toBe('Unknown');
		expect(track?.artist).toBe('Unknown');
		expect(track?.artistURL).toBeUndefined();
		expect(track?.imageURL).toBeUndefined();
	});

	test('throws on an API error', () => {
		expect(() => parseRecentTracks({ error: 6, message: 'User not found' })).toThrow(
			'User not found',
		);
	});
});

describe('LastFmScrobbler', () => {
	test('throws on an HTTP error', async () => {
		const fetcher: Fetcher = async () => ({
			ok: false,
			status: 429,
			statusText: 'Too Many Requests',
			json: async () => ({}),
		});

		await expect(LastFmScrobbler.fetchTrackData(preferences, fetcher)).rejects.toThrow('429');
	});

	test('links to the user profile', () => {
		expect(LastFmScrobbler.userUrl(preferences, 'a b')).toBe('https://www.last.fm/user/a%20b');
	});
});
