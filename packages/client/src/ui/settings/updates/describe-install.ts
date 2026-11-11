import type { NativeAndroidInstallProgress } from '@unbound-app/types/native-platform';
import type { AndroidBuild } from '@unbound-app/contracts/android-builds';

import type { DiscordBuilds } from '~/updates/discord-builds';
import { messages, format } from '~/i18n/api';

/**
 * @description Words a running or failed install for a row's sub-label.
 * @param progress The installer's progress.
 * @returns The text, or `undefined` while the installer is idle.
 */
export function describeProgress(progress: NativeAndroidInstallProgress): string | undefined {
	switch (progress.phase) {
		case 'downloading':
			return format('UNBOUND_DISCORD_DOWNLOADING', {
				percent: progress.total
					? Math.floor((progress.downloaded / progress.total) * 100)
					: 0,
			});
		case 'installing':
			return messages.UNBOUND_DISCORD_INSTALLING;
		case 'confirming':
			return messages.UNBOUND_DISCORD_CONFIRMING;
		case 'failed':
			return format('UNBOUND_DISCORD_INSTALL_FAILED', { error: progress.error ?? '' });
		case 'idle':
			return undefined;
	}
}

/**
 * @description Words where the installed Discord stands against its channel's newest build.
 * @param discord The installed Discord and its builds.
 * @returns The text.
 */
export function describeBuilds(discord: DiscordBuilds): string {
	const newest = discord.builds[0];

	switch (discord.status.availability) {
		case 'unpatched':
		case 'unsupported':
			return messages.UNBOUND_DISCORD_UNSUPPORTED;
		case 'needs-permission':
			return messages.UNBOUND_DISCORD_ALLOW_INSTALLS_DESC;
		case 'ready':
			break;
	}

	if (!newest) {
		return messages.UNBOUND_DISCORD_NO_BUILDS;
	}

	if (isSameBuild(newest, discord.installed)) {
		return messages.UNBOUND_DISCORD_UP_TO_DATE;
	}

	return format('UNBOUND_DISCORD_UPDATE_AVAILABLE', { version: newest.discordVersion });
}

/**
 * @description Whether two builds are the same Discord version patched from the same commit.
 * @param left A build.
 * @param right Another build, if any.
 * @returns `true` when they match.
 */
export function isSameBuild(left: AndroidBuild, right: AndroidBuild | undefined): boolean {
	return (
		right !== undefined &&
		left.channel === right.channel &&
		left.discordVersionCode === right.discordVersionCode &&
		left.commit === right.commit
	);
}
