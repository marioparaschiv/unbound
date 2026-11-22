/** The client's numbering restarted here after 3.12.1. */
export const RESET_CLIENT_VERSION = '1.0.0';

/**
 * @description Reads whether a client version is from before the reset: 2.x and 3.x. Valid only while the
 * client is below 2.0.0; a test fails once it gets there, so this rule is removed in time.
 * @param version A semver version.
 * @returns Whether `version` is a pre-reset client version.
 */
export function isPreResetVersion(version: string): boolean {
	const major = Number(version.split('.')[0]);

	return major === 2 || major === 3;
}

/**
 * @description Maps a client version onto the current numbering. A pre-reset client runs what 1.0.0 runs at
 * most, so it is treated as 1.0.0.
 * @param version The version a client reports.
 * @returns The version to compare against addon minimums.
 */
export function currentClientVersion(version: string): string {
	return isPreResetVersion(version) ? RESET_CLIENT_VERSION : version;
}

/**
 * @description Reads an addon manifest's `unbound.min` on the current numbering. Every client meets a
 * pre-reset minimum, so it reads as none.
 * @param min The manifest's `unbound.min`.
 * @returns The minimum client version, or `undefined` when any client runs the addon.
 */
export function minimumClientVersion(min: string | undefined): string | undefined {
	return min && !isPreResetVersion(min) ? min : undefined;
}
