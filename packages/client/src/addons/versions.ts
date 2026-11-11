import type { AddonVersion, ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonRelease } from '@unbound-app/contracts/updates';

import { createUnboundClient } from '~/account/client';
import type { ApiRequest } from '~/account/client';
import { compareVersions } from '~/core/versions';

/** A version that can be installed. `holds`: installing it pauses automatic updates for the addon. */
export type AvailableChoice = {
	type: 'available';
	version: AddonVersion;
	/** It is the newest version this client can run. */
	latest: boolean;
	holds: boolean;
};

/** One picker row, newest first. Only `available` rows can be chosen. */
export type VersionChoice =
	| AvailableChoice
	| { type: 'installed'; version: AddonVersion; latest: boolean }
	| { type: 'incompatible'; version: AddonVersion; requires: string };

/** What a tap on Install installs: the newest version this client runs, or the client it needs. */
export type InstallPick =
	| { type: 'available'; version: AddonVersion }
	| { type: 'incompatible'; requires: string };

/**
 * @description Asks `GET /api/v1/addons/$id/versions` for every live version of a listed addon.
 * @param id The addon's id.
 * @param request The Unbound API client to ask.
 * @returns The versions, newest first; rejects when the server can't be reached, answers with an
 * error, or no longer lists the addon.
 */
export async function fetchAddonVersions(
	id: string,
	request: ApiRequest = createUnboundClient(),
): Promise<AddonVersion[]> {
	const { versions } = await request('GET /api/v1/addons/$id/versions', {
		params: { id },
	});

	return versions;
}

function requiredClient(version: AddonVersion, clientVersion: string): string | undefined {
	const min = version.manifest.unbound?.min;

	return min && compareVersions(min, clientVersion) > 0 ? min : undefined;
}

/**
 * @description Projects an addon's versions onto the rows of the version picker.
 * @param versions The addon's live versions, newest first.
 * @param installed The installed version, or `undefined` when the addon is not installed.
 * @param clientVersion This client's version, compared with each manifest's `unbound.min`.
 * @returns One choice per version, in the given order.
 */
export function toVersionChoices(
	versions: AddonVersion[],
	installed: string | undefined,
	clientVersion: string,
): VersionChoice[] {
	const newest = newestRunnable(versions, clientVersion);

	return versions.map((version): VersionChoice => {
		const latest = version === newest;

		if (version.version === installed) {
			return { type: 'installed', version, latest };
		}

		const requires = requiredClient(version, clientVersion);

		if (requires) {
			return { type: 'incompatible', version, requires };
		}

		return { type: 'available', version, latest, holds: !latest };
	});
}

function newestRunnable(versions: AddonVersion[], clientVersion: string): AddonVersion | undefined {
	return versions.find((version) => !requiredClient(version, clientVersion));
}

/**
 * @description Picks the version Install installs: the catalog's latest when this client runs it,
 * otherwise the newest live version it runs, asking the server for the list only then.
 * @param addon The listed addon.
 * @param installed The installed version, or `undefined` when the addon is not installed.
 * @param clientVersion This client's version, compared with each manifest's `unbound.min`.
 * @param request The Unbound API client to ask.
 * @returns The version to install, or the client the latest needs when none runs here and is newer
 * than the installed one; rejects when the versions can't be fetched.
 */
export async function pickInstallVersion(
	addon: ListedAddon,
	installed: string | undefined,
	clientVersion: string,
	request: ApiRequest = createUnboundClient(),
): Promise<InstallPick> {
	const requires = requiredClient(addon.latestVersion, clientVersion);

	if (!requires) {
		return { type: 'available', version: addon.latestVersion };
	}

	const newest = newestRunnable(await fetchAddonVersions(addon.id, request), clientVersion);

	if (!newest || (installed !== void 0 && compareVersions(newest.version, installed) <= 0)) {
		return { type: 'incompatible', requires };
	}

	return { type: 'available', version: newest };
}

/**
 * @description Builds the release a manager's `update` installs from one listed version.
 * @param id The addon's id.
 * @param version The listed version.
 * @returns The release: where to fetch it and the bundle digest to verify.
 */
export function toRelease(id: string, version: AddonVersion): AddonRelease {
	const { manifestUrl, bundleUrl, sha256, changelog, changes } = version;

	return { id, version: version.version, manifestUrl, bundleUrl, sha256, changelog, changes };
}
