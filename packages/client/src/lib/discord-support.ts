const VERSION_PATTERN = /^\s*(\d+)\.(\d+)/;
const CHANNEL_PATTERN = /\s*-\s*(alpha|beta)\s*$/i;

export type DiscordChannel = 'Stable' | 'Beta' | 'Alpha';

export type ChannelVersion = { channel: DiscordChannel; version: string };

/**
 * @description Reads the release channel from a Discord version such as `352.10 - Beta`, counting TestFlight installs as Beta.
 * @param version The Discord version.
 * @param appSource Where Discord was installed from.
 * @returns The channel and the version without its channel suffix.
 */
export function discordChannel(version: string, appSource = ''): ChannelVersion {
	const suffix = CHANNEL_PATTERN.exec(version)?.[1]?.toLowerCase();
	const plain = version.replace(CHANNEL_PATTERN, '').trim();

	if (suffix === 'alpha') {
		return { channel: 'Alpha', version: plain };
	}

	if (suffix === 'beta' || appSource === 'TestFlight') {
		return { channel: 'Beta', version: plain };
	}

	return { channel: 'Stable', version: plain };
}

/**
 * @description Reads the major and minor number from a Discord version such as `350.8` or `352.10 - Beta`.
 * @param version The Discord version.
 * @returns The major and minor number, or `null` when the version has neither.
 */
export function parseDiscordVersion(version: string): [major: number, minor: number] | null {
	const match = VERSION_PATTERN.exec(version);

	if (!match) {
		return null;
	}

	return [Number(match[1]), Number(match[2])];
}

/**
 * @description Tells whether a Discord version is older than the oldest one Unbound supports.
 * @param version The running Discord version.
 * @param minimum The oldest supported Discord version.
 * @returns `true` only when both versions parse and `version` is older.
 */
export function isOlderThanSupported(version: string, minimum: string): boolean {
	const current = parseDiscordVersion(version);
	const oldest = parseDiscordVersion(minimum);

	if (!current || !oldest) {
		return false;
	}

	return current[0] < oldest[0] || (current[0] === oldest[0] && current[1] < oldest[1]);
}

/**
 * @description Tells whether to show the unsupported Discord toast, which appears once per Discord version.
 * @param version The running Discord version.
 * @param minimum The oldest supported Discord version.
 * @param warnedVersion The Discord version the toast was last shown for.
 * @returns `true` when the version is unsupported and the toast has not been shown for it.
 */
export function shouldWarnAboutDiscordVersion(
	version: string,
	minimum: string,
	warnedVersion: string,
): boolean {
	return isOlderThanSupported(version, minimum) && warnedVersion !== version;
}
