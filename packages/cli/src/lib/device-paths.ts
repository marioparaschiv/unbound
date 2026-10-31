/** Discord's bundle id on iOS. */
export const DISCORD_BUNDLE_ID = 'com.hammerandchisel.discord';

/** Discord's package name on Android. */
export const DISCORD_PACKAGE = 'com.discord';

/** Discord's private files folder on Android, which holds the `Unbound` folder. */
export const ANDROID_FILES_DIRECTORY = `/data/data/${DISCORD_PACKAGE}/files`;

/** The folder holding every app's data container on iOS. */
export const IOS_CONTAINERS_DIRECTORY = '/var/mobile/Containers/Data/Application';

/** The jailbreak's `tar`, which iOS does not ship. */
export const IOS_TAR = '/var/jb/usr/bin/tar';

/** The jailbreak's `uiopen`, which launches an app by its bundle id. */
export const IOS_UIOPEN = '/var/jb/usr/bin/uiopen';

export default {
	DISCORD_BUNDLE_ID,
	DISCORD_PACKAGE,
	ANDROID_FILES_DIRECTORY,
	IOS_CONTAINERS_DIRECTORY,
	IOS_TAR,
	IOS_UIOPEN,
};
