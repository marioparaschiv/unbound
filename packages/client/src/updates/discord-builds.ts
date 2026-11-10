import type {
	NativeAndroidInstallerStatus,
	NativePlatformAndroidInstaller,
} from '@unbound-app/types/native-platform';
import type { AndroidBuild, AndroidChannel } from '@unbound-app/contracts/android-builds';

import { createUnboundClient } from '~/account/client';
import type { ApiRequest } from '~/account/client';

/** The patched Discord this client runs in and the builds it can move to. */
export type DiscordBuilds = {
	status: NativeAndroidInstallerStatus;
	/** The channel's builds, newest Discord first; empty when the installer cannot use them. */
	builds: AndroidBuild[];
	/** The listed build whose splits match the installed ones, if any. */
	installed: AndroidBuild | undefined;
};

const CHANNEL_SUFFIXES: Record<string, AndroidChannel> = {
	stable: 'stable',
	beta: 'beta',
	alpha: 'alpha',
};

/**
 * @description Reads the Google Play channel from Discord's version name, such as `352.17 - Stable`.
 * @param versionName Discord's version name.
 * @returns The channel, or `undefined` when the name has no known suffix.
 */
export function discordChannel(versionName: string): AndroidChannel | undefined {
	const suffix = versionName.split(' - ')[1]?.trim().toLowerCase();

	return suffix ? CHANNEL_SUFFIXES[suffix] : undefined;
}

/**
 * @description Compares two Discord versions such as `352.17`, numerically by part.
 * @param left A Discord version.
 * @param right Another Discord version.
 * @returns A negative number when `left` is older, positive when newer, 0 when equal.
 */
export function compareDiscordVersions(left: string, right: string): number {
	const [leftMajor = 0, leftMinor = 0] = left.split('.').map(Number);
	const [rightMajor = 0, rightMinor = 0] = right.split('.').map(Number);

	return leftMajor - rightMajor || leftMinor - rightMinor;
}

/**
 * @description Finds the build whose every split matches the installed split of the same name.
 * @param builds The channel's builds.
 * @param installed SHA-256 of each installed split, `null` where unreadable.
 * @returns The installed build, or `undefined` when none matches.
 */
export function findInstalledBuild(
	builds: readonly AndroidBuild[],
	installed: Record<string, string | null>,
): AndroidBuild | undefined {
	const names = Object.keys(installed);

	return builds.find((build) =>
		names.every((name) =>
			build.splits.some((split) => split.name === name && split.sha256 === installed[name]),
		),
	);
}

/**
 * @description Whether moving to `build` installs an older Discord than the one running.
 * @param build The build to install.
 * @param versionName The installed Discord's version name.
 * @returns `true` for a downgrade.
 */
export function isOlderDiscord(build: AndroidBuild, versionName: string): boolean {
	return compareDiscordVersions(build.discordVersion, versionName.split(' ')[0] ?? '') < 0;
}

/**
 * @description The in-app Discord installer, when the loader exposes it.
 * @returns The installer, or `undefined` on iOS and on loaders without it.
 */
export function discordInstaller(): NativePlatformAndroidInstaller | undefined {
	return globalThis.NativePlatform?.android?.installer;
}

/**
 * @description Lists a channel's patched Discord builds from `GET /api/v1/loader/android-builds`.
 * @param channel The Google Play channel.
 * @param request The Unbound API client to ask.
 * @returns The builds, newest Discord first; rejects when the server can't be reached or answers with an error.
 */
export async function fetchDiscordBuilds(
	channel: AndroidChannel,
	request: ApiRequest = createUnboundClient(),
): Promise<AndroidBuild[]> {
	const { builds } = await request('GET /api/v1/loader/android-builds', { query: { channel } });

	return builds;
}

/**
 * @description Reads what the in-app installer can do and, when it can install, the builds of the installed channel.
 * @param request The Unbound API client to ask.
 * @returns The installed Discord and its builds, or `null` where the installer does not apply: iOS, or Discord not patched with LSPatch.
 */
export async function checkDiscordBuilds(
	request: ApiRequest = createUnboundClient(),
): Promise<DiscordBuilds | null> {
	const installer = discordInstaller();
	const status = installer?.status();

	if (!installer || !status || status.availability === 'unpatched') return null;

	const channel = discordChannel(status.versionName);

	if (status.availability === 'unsupported' || !channel) {
		return { status, builds: [], installed: undefined };
	}

	const [builds, hashes] = await Promise.all([
		fetchDiscordBuilds(channel, request),
		installer.installedSplits(),
	]);

	return { status, builds, installed: findInstalledBuild(builds, hashes) };
}

export default {
	discordChannel,
	compareDiscordVersions,
	findInstalledBuild,
	isOlderDiscord,
	discordInstaller,
	fetchDiscordBuilds,
	checkDiscordBuilds,
};
