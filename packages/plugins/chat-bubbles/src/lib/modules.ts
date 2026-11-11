import type { FluxMessage, FluxStore } from '@unbound-app/api/flux';
import { flux } from '@unbound-app/api';

type ThemeStoreType = FluxStore & {
	theme?: string;
};

type MessageStoreType = FluxStore & {
	getMessage?(channelId: string, id: string): FluxMessage | undefined;
};

export const ThemeStore = flux.getStore('Theme') as ThemeStoreType;

export const MessageStore = flux.getStore('Message') as MessageStoreType;

export const UserStore = flux.getStore('User');

export const SelectedChannelStore = flux.getStore('SelectedChannel');
