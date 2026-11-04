export const PLUGIN_NAME = 'Music Rich Presence';

export const DISCORD_APP_ID = '1108588077900898414';

export const LASTFM_API_KEY = '790c37d90400163a5a5fe00d6ca32ef0';

export const LASTFM_PLACEHOLDER_IMAGE_HASH = '2a96cbd8b46e442fc41c2b86b821562f';

export const LASTFM_API_KEY_URL = 'https://www.last.fm/api/account/create';

export const SOCKET_ID = 'MusicRichPresence@Unbound';

export const POLL_INTERVAL_MS = 16_000;

export const LOOKUP_CACHE_TTL_MS = 15 * 60 * 1000;

export const MUSICBRAINZ_USER_AGENT = 'Unbound/1.0 (https://github.com/unbound-app)';

export const ActivityType = {
	PLAYING: 0,
	LISTENING: 2,
	CUSTOM_STATUS: 4,
} as const;

export const ACTIVITY_FLAG_INSTANCE = 1;

export const StatusDisplayType = {
	NAME: 0,
	STATE: 1,
	DETAILS: 2,
} as const;

export const SCROBBLER_BACKENDS = ['lastfm', 'listenbrainz', 'listenbrainz-compatible'] as const;

export type ScrobblerBackendId = (typeof SCROBBLER_BACKENDS)[number];

export const STATUS_DISPLAY_TYPES = ['off', 'artist', 'track'] as const;

export type StatusDisplay = (typeof STATUS_DISPLAY_TYPES)[number];

export const NAME_FORMATS = [
	'status-name',
	'service-name',
	'artist-first',
	'song-first',
	'artist',
	'song',
	'album',
] as const;

export type NameFormat = (typeof NAME_FORMATS)[number];

export const MISSING_ART_MODES = ['logo', 'placeholder'] as const;

export type MissingArt = (typeof MISSING_ART_MODES)[number];

export const SETTINGS = {
	scrobblerBackend: 'lastfm' as ScrobblerBackendId,
	instanceBaseURL: '',
	instanceAPIBaseUrl: '',
	apiKey: '',
	username: '',
	shareUsername: false,
	clickableLinks: true,
	hideWithSpotify: true,
	hideWithActivity: false,
	statusName: 'some music',
	statusDisplayType: 'artist' as StatusDisplay,
	nameFormat: 'status-name' as NameFormat,
	useListeningStatus: false,
	missingArt: 'logo' as MissingArt,
	showLogo: true,
	showAlbumCover: true,
};

export type Preferences = typeof SETTINGS;
