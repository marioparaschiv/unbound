import { describe, expect, test } from 'bun:test';

import { SETTINGS } from '../../helpers/defaults';
import {
	apiUrl,
	coverArtFromResponse,
	createListenBrainz,
	linksFromIds,
	linksFromRecording,
	parsePlayingNow,
	recordingQueries,
	siteUrl,
	youtubeThumbnail,
} from '~/presence/scrobblers/listenbrainz';
import type { Fetcher } from '~/types';

const official = { ...SETTINGS, scrobblerBackend: 'listenbrainz' as const, username: 'rini' };
const custom = {
	...official,
	scrobblerBackend: 'listenbrainz-compatible' as const,
	instanceBaseURL: 'https://lb.example.org',
	instanceAPIBaseUrl: 'https://api.lb.example.org',
};

function fakeFetch(routes: Record<string, unknown>) {
	const calls: { url: string; headers?: Record<string, string> }[] = [];
	const fetcher: Fetcher = async (url, init) => {
		calls.push({ url, headers: init?.headers });
		const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));

		return match
			? { ok: true, status: 200, statusText: 'OK', json: async () => routes[match] }
			: { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
	};

	return { fetcher, calls };
}

describe('instance URLs', () => {
	test('use listenbrainz.org unless self-hosted', () => {
		expect(siteUrl(official, '/user/rini')).toBe('https://listenbrainz.org/user/rini');
		expect(apiUrl(official, '/1/x')).toBe('https://api.listenbrainz.org/1/x');
		expect(siteUrl(custom, '/user/rini')).toBe('https://lb.example.org/user/rini');
		expect(apiUrl(custom, '/1/x')).toBe('https://api.lb.example.org/1/x');
	});
});

describe('youtubeThumbnail', () => {
	test('reads the video id from common YouTube links', () => {
		expect(youtubeThumbnail('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
			'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
		);
		expect(youtubeThumbnail('https://youtu.be/dQw4w9WgXcQ')).toBe(
			'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
		);
		expect(youtubeThumbnail('https://m.youtube.com/embed/abc_-1')).toBe(
			'https://i.ytimg.com/vi/abc_-1/maxresdefault.jpg',
		);
	});

	test('ignores other links', () => {
		expect(youtubeThumbnail('https://open.spotify.com/track/1')).toBeUndefined();
		expect(youtubeThumbnail(undefined)).toBeUndefined();
	});
});

describe('recordingQueries', () => {
	test('searches by name, escaping Lucene characters', () => {
		const [query] = recordingQueries(undefined, 'Song (Live)', 'A-ha', 'Album');

		expect(query).toBe(
			encodeURIComponent(
				'artist:"A-ha" AND recording:"Song (Live)" AND release:"Album"',
			).replace(/[!()*\-~]/g, '\\$&'),
		);
		expect(query).toContain('A\\-ha');
		expect(query).toContain('\\(Live\\)');
	});

	test('leaves out the release when there is none', () => {
		expect(decodeURIComponent(recordingQueries(undefined, 'S', 'A', '')[0]!)).toBe(
			'artist:"A" AND recording:"S"',
		);
	});

	test('tries the ISRC first', () => {
		const queries = recordingQueries({ isrc: 'USRC17607839' }, 'S', 'A', '');

		expect(queries).toHaveLength(2);
		expect(queries[0]).toBe(encodeURIComponent('isrc:USRC17607839'));
	});
});

describe('response parsing', () => {
	test('reads the playing-now listen', () => {
		const track_metadata = { track_name: 'S', artist_name: 'A' };

		expect(
			parsePlayingNow({ payload: { listens: [{ playing_now: true, track_metadata }] } }),
		).toEqual(track_metadata);
		expect(parsePlayingNow({ payload: { listens: [] } })).toBeNull();
		expect(
			parsePlayingNow({ payload: { listens: [{ playing_now: false, track_metadata }] } }),
		).toBeNull();
		expect(parsePlayingNow(null)).toBeNull();
	});

	test('reads the cover art thumbnail', () => {
		expect(
			coverArtFromResponse({ images: [{ thumbnails: { large: 'https://c/l.jpg' } }] }),
		).toBe('https://c/l.jpg');
		expect(coverArtFromResponse({ images: [] })).toBeUndefined();
	});
});

describe('links', () => {
	test('come from MusicBrainz ids', () => {
		expect(
			linksFromIds(custom, {
				recording_mbid: 'rec',
				release_group_mbid: 'group',
				artist_mbids: ['art', 'other'],
			}),
		).toEqual({
			trackURL: 'https://lb.example.org/track/rec',
			albumURL: 'https://lb.example.org/release-group/group',
			artistURL: 'https://lb.example.org/artist/art',
		});
		expect(
			linksFromIds(official, { recording_mbid: 'rec', release_mbid: 'rel' }).albumURL,
		).toBe('https://listenbrainz.org/release/rel');
	});

	test('come from a recording search, preferring the named release', () => {
		const recording = {
			id: 'rec',
			'artist-credit': [{ artist: { id: 'art' } }],
			releases: [
				{ id: 'first', title: 'Single' },
				{ id: 'named', title: 'Album', 'release-group': { id: 'group' } },
			],
		};

		expect(linksFromRecording(official, recording, undefined, 'Album')).toEqual({
			trackURL: 'https://listenbrainz.org/track/rec/',
			albumURL: 'https://listenbrainz.org/release/named/',
			artistURL: 'https://listenbrainz.org/artist/art/',
			album: 'Album',
		});
		expect(linksFromRecording(official, recording, undefined, 'Other').album).toBe('Single');
		expect(linksFromRecording(official, { id: 'rec' }, undefined, '')).toEqual({
			trackURL: 'https://listenbrainz.org/track/rec/',
			albumURL: undefined,
			artistURL: undefined,
			album: 'Unknown',
		});
	});
});

describe('ListenBrainz scrobbler', () => {
	test('returns null when nothing is playing', async () => {
		const { fetcher } = fakeFetch({
			'https://api.listenbrainz.org/1/user/rini/playing-now': { payload: { listens: [] } },
		});

		expect(await createListenBrainz().scrobbler.fetchTrackData(official, fetcher)).toBeNull();
	});

	test('uses MusicBrainz ids and cover art for a well-tagged listen', async () => {
		const { fetcher } = fakeFetch({
			'https://api.lb.example.org/1/user/rini/playing-now': {
				payload: {
					listens: [
						{
							playing_now: true,
							track_metadata: {
								track_name: 'S',
								artist_name: 'A',
								release_name: 'Album',
								additional_info: {
									recording_mbid: 'rec',
									release_mbid: 'rel',
									artist_mbids: ['art'],
									music_service_name: 'Tidal',
								},
							},
						},
					],
				},
			},
			'https://coverartarchive.org/release/rel': {
				images: [{ thumbnails: { large: 'https://c/l.jpg' } }],
			},
		});

		expect(await createListenBrainz().scrobbler.fetchTrackData(custom, fetcher)).toEqual({
			name: 'S',
			artist: 'A',
			album: 'Album',
			serviceName: 'Tidal',
			imageURL: 'https://c/l.jpg',
			trackURL: 'https://lb.example.org/track/rec',
			albumURL: 'https://lb.example.org/release/rel',
			artistURL: 'https://lb.example.org/artist/art',
		});
	});

	test('searches MusicBrainz once and caches the result until invalidated', async () => {
		const { fetcher, calls } = fakeFetch({
			'https://api.listenbrainz.org/1/user/rini/playing-now': {
				payload: {
					listens: [
						{
							playing_now: true,
							track_metadata: {
								track_name: 'S',
								artist_name: 'A',
								additional_info: {
									submission_client: 'Web Scrobbler',
									origin_url: 'https://youtu.be/dQw4w9WgXcQ',
								},
							},
						},
					],
				},
			},
			'https://musicbrainz.org/ws/2/recording/': {
				recordings: [{ id: 'rec', releases: [{ id: 'rel', title: 'Album' }] }],
			},
		});
		const listenBrainz = createListenBrainz();
		const track = await listenBrainz.scrobbler.fetchTrackData(official, fetcher);

		expect(track).toMatchObject({
			name: 'S',
			album: 'Album',
			serviceName: 'Web Scrobbler',
			imageURL: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
			trackURL: 'https://listenbrainz.org/track/rec/',
			albumURL: 'https://listenbrainz.org/release/rel/',
		});

		const search = calls.find((call) => call.url.startsWith('https://musicbrainz.org'));

		expect(search?.headers?.['User-Agent']).toContain('Unbound');

		const lookups = () =>
			calls.filter((call) => call.url.startsWith('https://musicbrainz.org')).length;

		await listenBrainz.scrobbler.fetchTrackData(official, fetcher);
		expect(lookups()).toBe(1);

		listenBrainz.invalidate();
		await listenBrainz.scrobbler.fetchTrackData(official, fetcher);
		expect(lookups()).toBe(2);
	});

	test('throws when the API fails', async () => {
		const { fetcher } = fakeFetch({});

		await expect(
			createListenBrainz().scrobbler.fetchTrackData(official, fetcher),
		).rejects.toThrow('404');
	});

	test('links to the user profile', () => {
		expect(createListenBrainz().scrobbler.userUrl(custom, 'rini')).toBe(
			'https://lb.example.org/user/rini',
		);
	});
});
