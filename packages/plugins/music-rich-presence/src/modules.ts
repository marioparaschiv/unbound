import { flux, metro, storage } from '@unbound-app/api';

import type { PresenceActivity } from '~/types';

export const AssetManager = metro.findByProps('fetchAssetIds', 'getAssetIds', {
	lazy: true,
}) as {
	fetchAssetIds(applicationId: string, keys: string[]): Promise<(string | undefined)[]>;
};

export const SelfPresenceStore = flux.getStore('SelfPresence', { lazy: true }) as ReturnType<
	typeof flux.getStore
> & {
	getActivities?: () => PresenceActivity[] | undefined;
};

export const PresenceStore = flux.getStore('Presence', { lazy: true }) as ReturnType<
	typeof flux.getStore
> & {
	getActivities?: (userId: string) => PresenceActivity[] | undefined;
};

export const UserStore = flux.getStore('User', { lazy: true });

export const settings = storage.getBucket();
