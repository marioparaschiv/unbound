/** Discord's bundle id on iOS. */
export const DISCORD_BUNDLE_ID = 'com.hammerandchisel.discord';

/** Discord's package name on Android. */
export const DISCORD_PACKAGE = 'com.discord';

/** Discord's private files folder on Android, which holds the `Unbound` folder. */
export const ANDROID_FILES_DIRECTORY = `/data/data/${DISCORD_PACKAGE}/files`;

/** The world-writable folder files are staged in on Android, since adb cannot write into Discord's data. */
export const ANDROID_STAGING_DIRECTORY = '/data/local/tmp';

/** The folder holding every app's data container on iOS. */
export const IOS_CONTAINERS_DIRECTORY = '/var/mobile/Containers/Data/Application';

/** The jailbreak's `tar`, which iOS does not ship. */
export const IOS_TAR = '/var/jb/usr/bin/tar';

/** The jailbreak's `uiopen`, which launches an app by its bundle id. */
export const IOS_UIOPEN = '/var/jb/usr/bin/uiopen';

export const IOS_GZIP = '/var/jb/usr/bin/gzip';

/** The jailbreak's `split`, which cuts a file into parts small enough for one jb-p1lot frame. */
export const IOS_SPLIT = '/var/jb/usr/bin/split';

/** The folder files are staged in on iOS, since writes straight into an app container fail. */
export const IOS_STAGING_DIRECTORY = '/var/tmp';

export default {
	DISCORD_BUNDLE_ID,
	DISCORD_PACKAGE,
	ANDROID_FILES_DIRECTORY,
	ANDROID_STAGING_DIRECTORY,
	IOS_CONTAINERS_DIRECTORY,
	IOS_TAR,
	IOS_UIOPEN,
	IOS_GZIP,
	IOS_SPLIT,
	IOS_STAGING_DIRECTORY,
};
