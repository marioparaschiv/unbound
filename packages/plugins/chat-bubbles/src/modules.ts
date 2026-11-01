import type { FluxMessage, FluxStore } from '@unbound-app/api/flux';
import { storage, flux } from '@unbound-app/api';

type ThemeStoreType = FluxStore & {
	theme?: string;
};

type MessageStoreType = FluxStore & {
	getMessage?(channelId: string, id: string): FluxMessage | undefined;
};

export const SETTINGS_BUCKET = 'unbound.chat-bubbles';

export const ThemeStore = flux.getStore('Theme', { lazy: true }) as ThemeStoreType;

export const MessageStore = flux.getStore('Message', { lazy: true }) as MessageStoreType;

export const UserStore = flux.getStore('User', { lazy: true });

export const SelectedChannelStore = flux.getStore('SelectedChannel', { lazy: true });

export const settings = storage.getBucket(SETTINGS_BUCKET);
