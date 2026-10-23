import { loaderUpdateQuerySchema, loaderUpdateResponseSchema } from '@unbound-app/contracts/loader';
import type { LoaderUpdate, LoaderUpdateQuery } from '@unbound-app/contracts/loader';
import { createApiClient } from '@unbound-app/web/client';
import type { Api } from '@unbound-app/web/api';

export type LoaderUpdateCheckOptions = {
	baseUrl: string;
	/** The OS the client runs on, as React Native's `Platform.OS` names it. */
	platform: string;
	/** The native loader the client runs on; absent when no loader injected its info. */
	loader: UnboundLoaderInfo | undefined;
};

/**
 * @description Builds the query of `GET /api/v1/loader/updates` for the loader this client runs on.
 * @param platform The OS the client runs on, as React Native's `Platform.OS` names it.
 * @param loader The native loader's info, if one injected it.
 * @returns The query, or `undefined` without a loader, on a platform no loader ships for, or for a
 * loader version that is not semver, as on development builds.
 */
export function buildLoaderUpdateQuery(
	platform: string,
	loader: UnboundLoaderInfo | undefined,
): LoaderUpdateQuery | undefined {
	if (!loader) return;

	const query = loaderUpdateQuerySchema.safeParse({ platform, version: loader.version });

	return query.success ? query.data : undefined;
}

/**
 * @description Asks `GET /api/v1/loader/updates` whether a newer native loader release exists.
 * @param options The API origin, the OS and the loader's info.
 * @returns The update, or `null` when the loader is current or cannot be checked; rejects when the
 * server can't be reached or answers with an error.
 */
export async function fetchLoaderUpdate(
	options: LoaderUpdateCheckOptions,
): Promise<LoaderUpdate | null> {
	const query = buildLoaderUpdateQuery(options.platform, options.loader);

	if (!query) return null;

	const request = createApiClient<Api>({ baseUrl: options.baseUrl });
	const { update } = await request('GET /api/v1/loader/updates', {
		query,
		response: loaderUpdateResponseSchema,
	});

	return update;
}

export default { buildLoaderUpdateQuery, fetchLoaderUpdate };
