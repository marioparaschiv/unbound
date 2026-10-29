import { addonVersionsResponseSchema } from '@unbound-app/contracts/addons';
import type { AddonRelease } from '@unbound-app/contracts/updates';
import type { AddonVersion } from '@unbound-app/contracts/addons';
import { createApiClient } from '@unbound-app/web/client';
import type { Api } from '@unbound-app/web/api';

import { compareVersions } from '~/lib/catalog';

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

export type AddonVersionsOptions = {
	/** Origin of the Unbound web API. */
	baseUrl: string;
};

/**
 * @description Asks `GET /api/v1/addons/$id/versions` for every live version of a listed addon.
 * @param id The addon's id.
 * @param options The API origin.
 * @returns The versions, newest first; rejects when the server can't be reached, answers with an
 * error, or no longer lists the addon.
 */
export async function fetchAddonVersions(
	id: string,
	options: AddonVersionsOptions,
): Promise<AddonVersion[]> {
	const request = createApiClient<Api>({ baseUrl: options.baseUrl });
	const { versions } = await request('GET /api/v1/addons/$id/versions', {
		params: { id },
		response: addonVersionsResponseSchema,
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
	const newest = versions.find((version) => !requiredClient(version, clientVersion));

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

export default { fetchAddonVersions, toVersionChoices, toRelease };
