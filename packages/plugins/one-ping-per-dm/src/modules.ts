import { flux } from '@unbound-app/api';

export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });
export const ReadStateStore = flux.getStore('ReadState', { lazy: true }) as ReturnType<
	typeof flux.getStore
> & {
	getOldestUnreadMessageId?: (channelId: string) => string | null | undefined;
};
