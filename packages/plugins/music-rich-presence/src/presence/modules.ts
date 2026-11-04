import { flux, metro } from '@unbound-app/api';

import type { PresenceActivity } from '~/types';

export const AssetManager = metro.findByProps('fetchAssetIds', 'getAssetIds') as {
	fetchAssetIds(applicationId: string, keys: string[]): Promise<(string | undefined)[]>;
};

export const SelfPresenceStore = flux.getStore('SelfPresence') as ReturnType<
	typeof flux.getStore
> & {
	getActivities?: () => PresenceActivity[] | undefined;
};

export const PresenceStore = flux.getStore('Presence') as ReturnType<typeof flux.getStore> & {
	getActivities?: (userId: string) => PresenceActivity[] | undefined;
};

export const UserStore = flux.getStore('User');
