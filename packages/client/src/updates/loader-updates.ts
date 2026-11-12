import type { BundleChannel, LoaderUpdate, LoaderUpdateQuery } from '@unbound-app/contracts/loader';
import { isSemver } from '@unbound-app/contracts/manifest-patterns';
import type { UnboundLoaderInfo } from '@unbound-app/types';

import { createUnboundClient } from '~/account/client';
import type { ApiRequest } from '~/account/client';
import { compareVersions } from '~/core/versions';

export type LoaderUpdateCheckOptions = {
	/** The Unbound API client to ask; this client's when absent. */
	request?: ApiRequest;
	/** The OS the client runs on, as React Native's `Platform.OS` names it. */
	platform: string;
	/** The native loader the client runs on; absent when no loader installed `UnboundNative`. */
	loader: UnboundLoaderInfo | undefined;
	/** The channel this bundle was published to; only `stable` and `beta` have bundles the server knows. */
	channel?: string;
};

/** The result of a loader update check. */
export type LoaderCheck = {
	update: LoaderUpdate | null;
	/** The loader version the newest bundle needs while the installed loader is older; `null` otherwise. */
	requiredVersion: string | null;
};

const BUNDLE_CHANNELS: readonly string[] = ['stable', 'beta'] satisfies BundleChannel[];

function isBundleChannel(channel: string | undefined): channel is BundleChannel {
	return channel !== undefined && BUNDLE_CHANNELS.includes(channel);
}

/**
 * @description Builds the query of `GET /api/v1/loader/updates` for the loader this client runs on.
 * @param platform The OS the client runs on, as React Native's `Platform.OS` names it.
 * @param loader The native loader's info, if one injected it.
 * @param channel The channel this bundle was published to.
 * @returns The query, or `undefined` without a loader, on a platform no loader ships for, or for a
 * loader version that is not semver, as on development builds.
 */
export function buildLoaderUpdateQuery(
	platform: string,
	loader: UnboundLoaderInfo | undefined,
	channel?: string,
): LoaderUpdateQuery | undefined {
	if (!loader) return;

	if ((platform !== 'ios' && platform !== 'android') || !isSemver(loader.version)) return;

	return {
		platform,
		version: loader.version,
		...(isBundleChannel(channel) ? { channel } : {}),
	};
}

/**
 * @description Picks the loader version the newest bundle needs, dropping one the installed loader already
 * meets. The server's answer wins, since it names only loaders with a published release; without one, the
 * native loader's own refusal.
 * @param loader The native loader's info, if one injected it.
 * @param fromServer The server's answer: a version, `null` for none, or `undefined` when it gave none.
 * @returns The required version, or `null` when the installed loader runs the newest bundle.
 */
export function resolveRequiredLoader(
	loader: UnboundLoaderInfo | undefined,
	fromServer?: string | null,
): string | null {
	const required = fromServer === undefined ? loader?.requiredVersion : fromServer;

	if (!required || !isSemver(required)) return null;

	if (loader && isSemver(loader.version) && compareVersions(loader.version, required) >= 0) {
		return null;
	}

	return required;
}

/**
 * @description Asks `GET /api/v1/loader/updates` whether a newer native loader release exists, and whether
 * the newest bundle needs one.
 * @param options The API client, the OS, the loader's info and the bundle channel.
 * @returns The check; without a checkable loader only the native loader's own requirement. Rejects when
 * the server can't be reached or answers with an error.
 */
export async function fetchLoaderUpdate(options: LoaderUpdateCheckOptions): Promise<LoaderCheck> {
	const query = buildLoaderUpdateQuery(options.platform, options.loader, options.channel);

	if (!query) {
		return { update: null, requiredVersion: resolveRequiredLoader(options.loader) };
	}

	const { request = createUnboundClient() } = options;
	const { update, requiredVersion } = await request('GET /api/v1/loader/updates', {
		query,
	});

	return { update, requiredVersion: resolveRequiredLoader(options.loader, requiredVersion) };
}
