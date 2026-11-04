import type { Settings } from '@unbound-app/settings';

import type { Preferences } from '~/constants';

/**
 * @description Normalises a base URL typed by the user: trims it and drops trailing slashes.
 * @param value The URL as typed.
 * @returns The URL without surrounding whitespace or trailing slashes.
 */
export function normalizeBaseUrl(value: string): string {
	return value.trim().replace(/\/+$/, '');
}

/**
 * @description Reads every setting, trimming what the user typed.
 * @param settings The plugin's settings.
 * @returns The complete preferences.
 */
export function readPreferences(settings: Settings): Preferences {
	return {
		scrobblerBackend: settings.scrobblerBackend,
		instanceBaseURL: normalizeBaseUrl(settings.instanceBaseURL),
		instanceAPIBaseUrl: normalizeBaseUrl(settings.instanceAPIBaseUrl),
		apiKey: settings.apiKey.trim(),
		username: settings.username.trim(),
		shareUsername: settings.shareUsername,
		clickableLinks: settings.clickableLinks,
		hideWithSpotify: settings.hideWithSpotify,
		hideWithActivity: settings.hideWithActivity,
		statusName: settings.statusName,
		statusDisplayType: settings.statusDisplayType,
		nameFormat: settings.nameFormat,
		useListeningStatus: settings.useListeningStatus,
		missingArt: settings.missingArt,
		showLogo: settings.showLogo,
		showAlbumCover: settings.showAlbumCover,
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
