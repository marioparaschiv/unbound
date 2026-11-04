import type { Settings } from '@unbound-app/settings';

export const PLUGIN_NAME = 'Music Rich Presence';

export const DISCORD_APP_ID = '1108588077900898414';

export const LASTFM_API_KEY = '790c37d90400163a5a5fe00d6ca32ef0';

export const LASTFM_API_KEY_URL = 'https://www.last.fm/api/account/create';

export const LASTFM_PLACEHOLDER_IMAGE_HASH = '2a96cbd8b46e442fc41c2b86b821562f';

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

export type Preferences = Settings;

export type StatusDisplay = Preferences['statusDisplayType'];
