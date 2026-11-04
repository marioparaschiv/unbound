import { createTtlCache } from '~/cache';
import { LOOKUP_CACHE_TTL_MS, MUSICBRAINZ_USER_AGENT, type Preferences } from '~/constants';
import type { Fetcher, Scrobbler, TrackData } from '~/types';

type AdditionalInfo = {
	recording_mbid?: string;
	release_mbid?: string;
	release_group_mbid?: string;
	artist_mbids?: string[];
	origin_url?: string;
	isrc?: string;
	release_name?: string;
	music_service_name?: string;
	submission_client?: string;
};

type TrackMetadata = {
	track_name?: string;
	artist_name?: string;
	release_name?: string;
	additional_info?: AdditionalInfo;
};

type PlayingNowResponse = {
	payload?: { listens?: { playing_now?: boolean; track_metadata?: TrackMetadata }[] };
};

type Recording = {
	id: string;
	'artist-credit'?: { artist?: { id?: string } }[];
	releases?: { id?: string; title?: string; 'release-group'?: { id?: string } }[];
};

type Links = Partial<TrackData>;

const YOUTUBE_VIDEO_URL =
	/^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube(?:-nocookie)?\.com|youtu.be))(\/(?:[\w-]+\?v=|embed\/|live\/|v\/)?)([\w-]+)(\S+)?$/;

/**
 * @description Builds a URL on the ListenBrainz website, or on the self-hosted instance when one is chosen.
 * @param preferences The current preferences.
 * @param path The path, starting with `/`.
 * @returns The full website URL.
 */
export function siteUrl(preferences: Preferences, path: string): string {
	const base =
		preferences.scrobblerBackend === 'listenbrainz-compatible'
			? preferences.instanceBaseURL
			: 'https://listenbrainz.org';

	return `${base}${path}`;
}

/**
 * @description Builds a URL on the ListenBrainz API, or on the self-hosted API when one is chosen.
 * @param preferences The current preferences.
 * @param path The path, starting with `/`.
 * @returns The full API URL.
 */
export function apiUrl(preferences: Preferences, path: string): string {
	const base =
		preferences.scrobblerBackend === 'listenbrainz-compatible'
			? preferences.instanceAPIBaseUrl
			: 'https://api.listenbrainz.org';

	return `${base}${path}`;
}

/**
 * @description Turns a YouTube video link into the URL of its largest thumbnail.
 * @param originUrl The link a listen was played from.
 * @returns The thumbnail URL, or `undefined` when the link is not a YouTube video.
 */
export function youtubeThumbnail(originUrl: string | undefined): string | undefined {
	const id = originUrl?.match(YOUTUBE_VIDEO_URL)?.[5];

	return id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : undefined;
}

/**
 * @description Builds the MusicBrainz recording searches for a listen, ISRC first when it has one.
 * @param info The listen's additional info.
 * @param trackName The track title.
 * @param artistName The artist name.
 * @param releaseName The album name.
 * @returns The encoded Lucene queries, in the order to try them.
 */
export function recordingQueries(
	info: AdditionalInfo | undefined,
	trackName: string,
	artistName: string,
	releaseName: string,
): string[] {
	const release = releaseName ? ` AND release:"${releaseName}"` : '';
	const nameQuery = encodeURIComponent(
		`artist:"${artistName}" AND recording:"${trackName}"${release}`,
	).replace(/[!()*\-~]/g, '\\$&');

	return info?.isrc ? [encodeURIComponent(`isrc:${info.isrc}`), nameQuery] : [nameQuery];
}

/**
 * @description Reads the playing-now listen out of a ListenBrainz `playing-now` response.
 * @param json The parsed response body.
 * @returns The listen's metadata, or `null` when nothing is playing.
 */
export function parsePlayingNow(json: unknown): TrackMetadata | null {
	const listen = (json as PlayingNowResponse | null)?.payload?.listens?.[0];

	return listen?.playing_now && listen.track_metadata ? listen.track_metadata : null;
}

/**
 * @description Reads the large thumbnail of the first image in a Cover Art Archive response.
 * @param json The parsed response body.
 * @returns The thumbnail URL, or `undefined` when the release has no art.
 */
export function coverArtFromResponse(json: unknown): string | undefined {
	return (json as { images?: { thumbnails?: { large?: string } }[] } | null)?.images?.[0]
		?.thumbnails?.large;
}

/**
 * @description Builds the track, album and artist links from the MusicBrainz ids a well-tagged listen carries.
 * @param preferences The current preferences.
 * @param info The listen's additional info, which has a `recording_mbid`.
 * @returns The links, without the image.
 */
export function linksFromIds(preferences: Preferences, info: AdditionalInfo): Links {
	const { release_mbid, release_group_mbid, recording_mbid, artist_mbids } = info;

	return {
		trackURL: siteUrl(preferences, `/track/${recording_mbid}`),
		albumURL: release_mbid
			? siteUrl(preferences, `/release/${release_mbid}`)
			: release_group_mbid
				? siteUrl(preferences, `/release-group/${release_group_mbid}`)
				: undefined,
		artistURL: artist_mbids?.length
			? siteUrl(preferences, `/artist/${artist_mbids[0]}`)
			: undefined,
	};
}

/**
 * @description Picks the release a MusicBrainz recording search result belongs to, preferring the album the listen names.
 * @param recording The first search result.
 * @param releaseName The album the listen names.
 * @returns The matching release, else the first one.
 */
export function pickRelease(recording: Recording, releaseName: string) {
	return (
		recording.releases?.find((release) => release.title === releaseName) ??
		recording.releases?.[0]
	);
}

/**
 * @description Builds the track, album and artist links from a MusicBrainz recording search result.
 * @param preferences The current preferences.
 * @param recording The first search result.
 * @param info The listen's additional info.
 * @param releaseName The album the listen names.
 * @returns The links and album name, without the image.
 */
export function linksFromRecording(
	preferences: Preferences,
	recording: Recording,
	info: AdditionalInfo | undefined,
	releaseName: string,
): Links {
	const artist = recording['artist-credit']?.[0]?.artist;
	const release = pickRelease(recording, releaseName);
	const releaseGroupId = release?.['release-group']?.id;

	return {
		trackURL: siteUrl(preferences, `/track/${recording.id}/`),
		albumURL: release?.id
			? siteUrl(preferences, `/release/${release.id}/`)
			: releaseGroupId
				? siteUrl(preferences, `/release-group/${releaseGroupId}/`)
				: undefined,
		artistURL: artist?.id ? siteUrl(preferences, `/artist/${artist.id}/`) : undefined,
		album: info?.release_name ?? release?.title ?? 'Unknown',
	};
}

async function readJson(fetcher: Fetcher, url: string, headers?: Record<string, string>) {
	const response = await fetcher(url, headers ? { headers } : undefined);

	if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

	return response.json();
}

/**
 * @description Creates the ListenBrainz scrobbler, with its own cover art and MusicBrainz caches.
 * @returns The scrobbler and `invalidate`, which empties its caches.
 */
export function createListenBrainz() {
	const coverArtCache = createTtlCache<string, string | undefined>(LOOKUP_CACHE_TTL_MS);
	const metadataCache = createTtlCache<string, Links | null>(LOOKUP_CACHE_TTL_MS);

	async function coverArtArchive(fetcher: Fetcher, id: string, path: string) {
		if (coverArtCache.has(id)) return coverArtCache.get(id);

		const url = coverArtFromResponse(
			await readJson(fetcher, `https://coverartarchive.org${path}`),
		);

		coverArtCache.set(id, url);
		return url;
	}

	async function coverArt(
		fetcher: Fetcher,
		releaseId: string | undefined,
		releaseGroupId: string | undefined,
		originUrl: string | undefined,
	) {
		return (
			(releaseId &&
				(await coverArtArchive(fetcher, releaseId, `/release/${releaseId}`).catch(
					() => null,
				))) ||
			(releaseGroupId &&
				(await coverArtArchive(
					fetcher,
					releaseGroupId,
					`/release-group/${releaseGroupId}`,
				).catch(() => null))) ||
			youtubeThumbnail(originUrl)
		);
	}

	async function findRecording(fetcher: Fetcher, query: string) {
		const params = new URLSearchParams({ fmt: 'json', limit: '1' });
		const json = await readJson(
			fetcher,
			`https://musicbrainz.org/ws/2/recording/?${params}&query=${query}`,
			{ 'User-Agent': MUSICBRAINZ_USER_AGENT },
		);

		return (json as { recordings?: Recording[] } | null)?.recordings?.[0];
	}

	async function links(
		preferences: Preferences,
		fetcher: Fetcher,
		metadata: TrackMetadata,
	): Promise<Links> {
		const info = metadata.additional_info;
		const trackName = metadata.track_name ?? '';
		const artistName = metadata.artist_name ?? '';
		const releaseName = metadata.release_name ?? '';

		if (info?.recording_mbid) {
			return {
				imageURL: await coverArt(
					fetcher,
					info.release_mbid,
					info.release_group_mbid,
					info.origin_url,
				),
				...linksFromIds(preferences, info),
			};
		}

		const queries = recordingQueries(info, trackName, artistName, releaseName);

		for (const query of queries) {
			if (metadataCache.has(query)) return metadataCache.get(query) ?? {};

			const recording = await findRecording(fetcher, query);

			if (!recording) continue;

			const release = pickRelease(recording, releaseName);
			const data: Links = {
				imageURL: await coverArt(
					fetcher,
					release?.id,
					release?.['release-group']?.id,
					info?.origin_url,
				),
				...linksFromRecording(preferences, recording, info, releaseName),
			};

			metadataCache.set(query, data);
			return data;
		}

		const fallback: Links = info?.origin_url
			? { imageURL: youtubeThumbnail(info.origin_url) }
			: {};

		metadataCache.set(queries.at(-1)!, fallback);
		return fallback;
	}

	const scrobbler: Scrobbler = {
		name: 'ListenBrainz',
		id: 'listenbrainz',

		async fetchTrackData(preferences, fetcher) {
			const url = apiUrl(
				preferences,
				`/1/user/${encodeURIComponent(preferences.username)}/playing-now`,
			);
			const metadata = parsePlayingNow(await readJson(fetcher, url));

			if (!metadata) return null;

			const info = metadata.additional_info;

			return {
				name: metadata.track_name || 'Unknown',
				artist: metadata.artist_name ?? '',
				album: metadata.release_name || 'Unknown',
				serviceName: info?.music_service_name || info?.submission_client,
				...(await links(preferences, fetcher, metadata)),
			};
		},

		userUrl(preferences, username) {
			return siteUrl(preferences, `/user/${encodeURIComponent(username)}`);
		},
	};

	return {
		scrobbler,
		invalidate: () => {
			coverArtCache.clear();
			metadataCache.clear();
		},
	};
}
