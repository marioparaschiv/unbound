import { flux, metro, storage } from '@unbound-app/api';

import type { ChannelLike } from '~/nsfw';

type ChannelStoreType = {
	getChannel(id: string): ChannelLike | undefined;
};

export const ChannelStore = flux.getStore('Channel', { lazy: true }) as unknown as ChannelStoreType;

export const byRowManager = metro.filters.byName('RowManager');

export const settings = storage.getBucket();
