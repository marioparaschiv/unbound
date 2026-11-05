import type { BundleChannel, LoaderUpdate, LoaderUpdateQuery } from '@unbound-app/contracts/loader';
import { isSemver } from '@unbound-app/contracts/manifest-patterns';
import type { UnboundLoaderInfo } from '@unbound-app/types';
import { createApiClient } from '@unbound-app/web/client';
import type { Api } from '@unbound-app/web/api';

import { compareVersions } from '~/core/versions';

export type LoaderUpdateCheckOptions = {
	baseUrl: string;
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
 * @description Picks the loader version the newest bundle needs, from the server or else from the native
 * loader's own refusal, dropping one the installed loader already meets.
 * @param loader The native loader's info, if one injected it.
 * @param fromServer The version the server reported, if any.
 * @returns The required version, or `null` when the installed loader runs the newest bundle.
 */
export function resolveRequiredLoader(
	loader: UnboundLoaderInfo | undefined,
	fromServer: string | null = null,
): string | null {
	const required = fromServer ?? loader?.requiredVersion;

	if (!required || !isSemver(required)) return null;

	if (loader && isSemver(loader.version) && compareVersions(loader.version, required) >= 0) {
		return null;
	}

	return required;
}

/**
 * @description Asks `GET /api/v1/loader/updates` whether a newer native loader release exists, and whether
 * the newest bundle needs one.
 * @param options The API origin, the OS, the loader's info and the bundle channel.
 * @returns The check; without a checkable loader only the native loader's own requirement. Rejects when
 * the server can't be reached or answers with an error.
 */
export async function fetchLoaderUpdate(options: LoaderUpdateCheckOptions): Promise<LoaderCheck> {
	const query = buildLoaderUpdateQuery(options.platform, options.loader, options.channel);

	if (!query) {
		return { update: null, requiredVersion: resolveRequiredLoader(options.loader) };
	}

	const request = createApiClient<Api>({ baseUrl: options.baseUrl });
	const { update, requiredVersion } = await request('GET /api/v1/loader/updates', {
		query,
	});

	return { update, requiredVersion: resolveRequiredLoader(options.loader, requiredVersion) };
}

export default { buildLoaderUpdateQuery, resolveRequiredLoader, fetchLoaderUpdate };
