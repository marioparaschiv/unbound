import { settings } from '@unbound-app/settings';
import { storage } from '@unbound-app/api';

import type { ProviderId } from '~/lib/types';

/**
 * @description Reads the provider the user picked, from the plugin's settings.
 * @returns The provider.
 */
export function getSelectedProvider(): ProviderId {
	return settings.provider;
}

/**
 * @description Saves the provider the user picked.
 * @param id The provider.
 */
export function setSelectedProvider(id: ProviderId): void {
	settings.provider = id;
}

/**
 * @description Runs `listener` each time the user picks another provider.
 * @param listener Receives the new provider.
 * @returns A function that stops listening.
 */
export function onProviderChange(listener: (id: ProviderId) => void): () => void {
	return storage.onChange(
		(payload) =>
			payload.store === addon.id && (payload.key === null || payload.key === 'provider'),
		() => listener(getSelectedProvider()),
	);
}
