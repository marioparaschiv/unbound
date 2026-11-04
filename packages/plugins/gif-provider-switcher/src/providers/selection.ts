import { PROVIDERS } from '~/constants';
import type { ProviderId, ReplacementProviderId } from '~/types';

/**
 * @description Checks whether a provider replaces Discord's own Klipy search.
 * @param id The provider.
 * @returns `true` for Tenor and Giphy.
 */
export function isReplacement(id: ProviderId): id is ReplacementProviderId {
	return id !== 'klipy';
}

/**
 * @description Returns the provider after `id` in the picker's order, wrapping around.
 * @param id The current provider.
 * @returns The next provider.
 */
export function nextProvider(id: ProviderId): ProviderId {
	const index = PROVIDERS.findIndex((provider) => provider.id === id);

	return PROVIDERS[(index + 1) % PROVIDERS.length]!.id;
}

/**
 * @description Returns a provider's display name.
 * @param id The provider.
 * @returns Its name, such as `Tenor`.
 */
export function providerLabel(id: ProviderId): string {
	return PROVIDERS.find((provider) => provider.id === id)?.label ?? id;
}
