import type { BuildTrack } from '~/lib/downloads/builds';

/** An app that adds a source or repo through its URL scheme, as AltDirect and repo pages link them. */
export type SourceApp = {
	name: string;
	/** The app's icon under `public/`. */
	icon: string;
	href: string;
};

/** The source SideStore, Feather and AltStore add to list Unbound. */
export const APP_SOURCE_URL = 'https://repo.unbound.rip/app-repo.json';

/** The repo Sileo and other jailbreak package managers add. */
export const JAILBREAK_REPO_URL = 'https://repo.unbound.rip';

/** Every loader release CI has published. */
export const RELEASES_URL = 'https://github.com/marioparaschiv/unbound/releases';

/** Sideloading tools that open the Unbound source already filled in; schemes match AltDirect's. */
export const SIDELOADERS: SourceApp[] = [
	{
		name: 'Feather',
		icon: '/img/sources/feather.webp',
		href: `feather://source/${APP_SOURCE_URL}`,
	},
	{
		name: 'SideStore',
		icon: '/img/sources/sidestore.webp',
		href: `sidestore://source?url=${APP_SOURCE_URL}`,
	},
	{
		name: 'AltStore',
		icon: '/img/sources/altstore.webp',
		href: `altstore-classic://source?url=${APP_SOURCE_URL}`,
	},
];

/** Jailbreak package managers that open the Unbound repo already filled in. */
export const PACKAGE_MANAGERS: SourceApp[] = [
	{
		name: 'Sileo',
		icon: '/img/sources/sileo.webp',
		href: `sileo://source/${JAILBREAK_REPO_URL}`,
	},
	{
		name: 'Zebra',
		icon: '/img/sources/zebra.webp',
		href: `zbra://sources/add/${JAILBREAK_REPO_URL}`,
	},
];

/** Sideloading tools for an iPhone without one, each linked to its own setup guide. */
export const SIDELOADING_TOOLS: SourceApp[] = [
	{ name: 'SideStore', icon: '/img/sources/sidestore.webp', href: 'https://sidestore.io' },
	{
		name: 'Feather',
		icon: '/img/sources/feather.webp',
		href: 'https://github.com/khcrysalis/Feather',
	},
	{ name: 'AltStore', icon: '/img/sources/altstore.webp', href: 'https://altstore.io' },
];

export const OBTAINIUM_ICON = '/img/sources/obtainium.webp';

// Each opens Obtainium with the track's source filled in; they mirror the installing guide's links.
const OBTAINIUM_URLS: Partial<Record<BuildTrack, string>> = {
	android:
		'obtainium://app/%7B%22id%22%3A%22com.discord%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fmarioparaschiv%2Funbound%22%2C%22author%22%3A%22unbound-app%22%2C%22name%22%3A%22Unbound%22%2C%22additionalSettings%22%3A%22%7B%5C%22apkFilterRegEx%5C%22%3A%5C%22%5EUnbound%5C%5C%5C%5C.apks%24%5C%22%2C%5C%22filterReleaseTitlesByRegEx%5C%22%3A%5C%22%5EUnbound%20.%2B%20for%20Discord%20%5B0-9%5D%2B%5C%5C%5C%5C.%5B0-9%5D%2B%2C%20Android%24%5C%22%2C%5C%22fallbackToOlderReleases%5C%22%3Atrue%2C%5C%22sortMethodChoice%5C%22%3A%5C%22date%5C%22%7D%22%7D',
	'android-beta':
		'obtainium://app/%7B%22id%22%3A%22com.discord%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fmarioparaschiv%2Funbound%22%2C%22author%22%3A%22unbound-app%22%2C%22name%22%3A%22Unbound%20%28Discord%20beta%29%22%2C%22additionalSettings%22%3A%22%7B%5C%22apkFilterRegEx%5C%22%3A%5C%22%5EUnbound-beta%5C%5C%5C%5C.apks%24%5C%22%2C%5C%22filterReleaseTitlesByRegEx%5C%22%3A%5C%22%5EUnbound%20.%2B%20for%20Discord%20%5B0-9%5D%2B%5C%5C%5C%5C.%5B0-9%5D%2B%2C%20Android%20beta%24%5C%22%2C%5C%22fallbackToOlderReleases%5C%22%3Atrue%2C%5C%22sortMethodChoice%5C%22%3A%5C%22date%5C%22%2C%5C%22includePrereleases%5C%22%3Atrue%7D%22%7D',
	'android-alpha':
		'obtainium://app/%7B%22id%22%3A%22com.discord%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fmarioparaschiv%2Funbound%22%2C%22author%22%3A%22unbound-app%22%2C%22name%22%3A%22Unbound%20%28Discord%20alpha%29%22%2C%22additionalSettings%22%3A%22%7B%5C%22apkFilterRegEx%5C%22%3A%5C%22%5EUnbound-alpha%5C%5C%5C%5C.apks%24%5C%22%2C%5C%22filterReleaseTitlesByRegEx%5C%22%3A%5C%22%5EUnbound%20.%2B%20for%20Discord%20%5B0-9%5D%2B%5C%5C%5C%5C.%5B0-9%5D%2B%2C%20Android%20alpha%24%5C%22%2C%5C%22fallbackToOlderReleases%5C%22%3Atrue%2C%5C%22sortMethodChoice%5C%22%3A%5C%22date%5C%22%2C%5C%22includePrereleases%5C%22%3Atrue%7D%22%7D',
};

/**
 * @description The Obtainium link that adds a track's builds, for the Android tracks that have one.
 * @param track The build's track.
 * @returns The `obtainium://` link, or `undefined` for a track Obtainium does not install.
 */
export function getObtainiumUrl(track: BuildTrack): string | undefined {
	return OBTAINIUM_URLS[track];
}

export default {
	APP_SOURCE_URL,
	JAILBREAK_REPO_URL,
	RELEASES_URL,
	SIDELOADERS,
	PACKAGE_MANAGERS,
	SIDELOADING_TOOLS,
	OBTAINIUM_ICON,
	getObtainiumUrl,
};
