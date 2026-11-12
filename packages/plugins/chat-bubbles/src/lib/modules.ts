import type { FluxMessage, FluxStore } from '@unbound-app/api/flux';
import { flux, metro } from '@unbound-app/api';

type ThemeStoreType = FluxStore & {
	theme?: string;
};

type MessageStoreType = FluxStore & {
	getMessage?(channelId: string, id: string): FluxMessage | undefined;
	/** A channel's loaded messages, the same object until they change. */
	getMessages?(channelId: string): { toArray?(): FluxMessage[] } | undefined;
};

type ReadStateStoreType = FluxStore & {
	getOldestUnreadMessageId?(channelId: string): string | null | undefined;
};

export const ThemeStore = flux.getStore('Theme') as ThemeStoreType;

export const Theme = metro.common.Theme;

export const MessageStore = flux.getStore('Message') as MessageStoreType;

export const UserStore = flux.getStore('User');

export const SelectedChannelStore = flux.getStore('SelectedChannel');

export const ChannelStore = flux.getStore('Channel');

export const ReadStateStore = flux.getStore('ReadState') as ReadStateStoreType;

/** Builds a channel's chat rows, newest first, each message marking whether it starts its group. */
export const ChannelStream = metro.findByName('createChannelStream', { interop: false });

/** Discord's rule for whether a message starts a new group after its group's first message: another author, day or time window, a reply, and so on. */
export const MessageGroupRule = metro.findByName('isNewMessageGroup', { interop: false });
