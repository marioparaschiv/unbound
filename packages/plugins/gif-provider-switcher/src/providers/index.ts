import { createGiphyProvider } from '~/providers/giphy';
import { createTenorProvider } from '~/providers/tenor';
import { fetchJson } from '~/providers/fetch-json';
import type { GifProvider, ReplacementProviderId } from '~/types';

const providers: Record<ReplacementProviderId, GifProvider> = {
	tenor: createTenorProvider(fetchJson),
	giphy: createGiphyProvider(fetchJson),
};

/**
 * @description Returns the provider that serves GIF searches in place of Discord's Klipy.
 * Tenor and Giphy are called straight from the app with `fetch`, using the public keys Vencord uses (Tenor's from Gboard on iOS, Giphy's from giphy.com).
 * @param id The provider the user picked.
 * @returns The provider.
 */
export function getProvider(id: ReplacementProviderId): GifProvider {
	return providers[id];
}
