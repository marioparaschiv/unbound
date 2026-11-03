import {
	MISSING_ART_MODES,
	NAME_FORMATS,
	SCROBBLER_BACKENDS,
	SETTINGS,
	STATUS_DISPLAY_TYPES,
	type Preferences,
} from '~/constants';

type Read = <T>(key: string, def: T) => unknown;

function oneOf<T extends string>(allowed: readonly T[], value: unknown, def: T): T {
	return allowed.includes(value as T) ? (value as T) : def;
}

function text(value: unknown, def: string): string {
	return typeof value === 'string' ? value : def;
}

function flag(value: unknown, def: boolean): boolean {
	return typeof value === 'boolean' ? value : def;
}

/**
 * @description Normalises a base URL typed by the user: trims it and drops trailing slashes.
 * @param value The URL as typed.
 * @returns The URL without surrounding whitespace or trailing slashes.
 */
export function normalizeBaseUrl(value: string): string {
	return value.trim().replace(/\/+$/, '');
}

/**
 * @description Reads every setting from a store, falling back to the default for a missing or malformed value.
 * @param read Reads one key with its default, like `Bucket.get`.
 * @returns The complete, validated preferences.
 */
export function readPreferences(read: Read): Preferences {
	const value = <K extends keyof Preferences>(key: K) => read(key, SETTINGS[key]);

	return {
		scrobblerBackend: oneOf(
			SCROBBLER_BACKENDS,
			value('scrobblerBackend'),
			SETTINGS.scrobblerBackend,
		),
		instanceBaseURL: normalizeBaseUrl(text(value('instanceBaseURL'), SETTINGS.instanceBaseURL)),
		instanceAPIBaseUrl: normalizeBaseUrl(
			text(value('instanceAPIBaseUrl'), SETTINGS.instanceAPIBaseUrl),
		),
		apiKey: text(value('apiKey'), SETTINGS.apiKey).trim(),
		username: text(value('username'), SETTINGS.username).trim(),
		shareUsername: flag(value('shareUsername'), SETTINGS.shareUsername),
		clickableLinks: flag(value('clickableLinks'), SETTINGS.clickableLinks),
		hideWithSpotify: flag(value('hideWithSpotify'), SETTINGS.hideWithSpotify),
		hideWithActivity: flag(value('hideWithActivity'), SETTINGS.hideWithActivity),
		statusName: text(value('statusName'), SETTINGS.statusName),
		statusDisplayType: oneOf(
			STATUS_DISPLAY_TYPES,
			value('statusDisplayType'),
			SETTINGS.statusDisplayType,
		),
		nameFormat: oneOf(NAME_FORMATS, value('nameFormat'), SETTINGS.nameFormat),
		useListeningStatus: flag(value('useListeningStatus'), SETTINGS.useListeningStatus),
		missingArt: oneOf(MISSING_ART_MODES, value('missingArt'), SETTINGS.missingArt),
		showLogo: flag(value('showLogo'), SETTINGS.showLogo),
		showAlbumCover: flag(value('showAlbumCover'), SETTINGS.showAlbumCover),
	};
}

/**
 * @description Tells whether a self-hosted ListenBrainz backend is chosen without both of its URLs.
 * @param preferences The current preferences.
 * @returns `true` when the custom instance cannot be queried.
 */
export function hasInvalidCustomInstance(preferences: Preferences): boolean {
	return (
		preferences.scrobblerBackend === 'listenbrainz-compatible' &&
		(!preferences.instanceAPIBaseUrl || !preferences.instanceBaseURL)
	);
}

/**
 * @description Tells whether the plugin has enough settings to look up what is playing.
 * @param preferences The current preferences.
 * @returns `true` when a username is set and the backend is usable.
 */
export function canQuery(preferences: Preferences): boolean {
	return Boolean(preferences.username) && !hasInvalidCustomInstance(preferences);
}
