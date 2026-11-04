import { flux, metro } from '@unbound-app/api';

import type { ChannelLike } from '~/blur-nsfw/nsfw';

type ChannelStoreType = {
	getChannel(id: string): ChannelLike | undefined;
};

export const ChannelStore = flux.getStore('Channel') as unknown as ChannelStoreType;

export const RowManager = metro.findByName('RowManager');
