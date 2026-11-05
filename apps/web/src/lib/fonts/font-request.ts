import type { FontProvider } from '@unbound-app/contracts/fonts';

import { ApiError } from '~/lib/api/errors';

import type { FontFetch } from './font-source';

/** How long one provider request may take before the resolver gives up on it. */
const TIMEOUT_MS = 10_000;

/**
 * Google serves full `.ttf` files to clients that are not browsers, and split WOFF2 to browsers. A
 * fixed agent keeps the format the same whoever asks.
 */
const USER_AGENT = 'Unbound';

function unavailable(provider: FontProvider, reason: string): ApiError {
	return new ApiError(
		'font_source_unavailable',
		`The ${provider} font service did not answer (${reason}). Try again in a few minutes.`,
	);
}

/**
 * @description Requests a provider URL with a timeout and a fixed user agent.
 * @param fetch The fetch to send it with.
 * @param provider The provider asked, named in the error.
 * @param url The URL.
 * @returns The response, or `undefined` when the provider answers that the family does not exist.
 */
export async function requestFontSource(
	fetch: FontFetch,
	provider: FontProvider,
	url: string,
): Promise<Response | undefined> {
	let response: Response;

	try {
		response = await fetch(url, {
			headers: { 'user-agent': USER_AGENT },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch {
		throw unavailable(provider, 'network error');
	}

	if (response.status === 400 || response.status === 404) return;

	if (!response.ok) {
		throw unavailable(provider, `status ${response.status}`);
	}

	return response;
}

export default { requestFontSource };
