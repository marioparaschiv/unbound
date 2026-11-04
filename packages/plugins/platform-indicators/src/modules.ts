import type { FluxStore } from '@unbound-app/api/flux';
import { metro, storage, flux } from '@unbound-app/api';

import type { ClientStatusMap } from '~/platforms';

export type PresenceFluxStore = FluxStore & {
	getClientStatus(userId: string): ClientStatusMap | null | undefined;
	isMobileOnline(userId: string): boolean;
};

export type SessionsFluxStore = FluxStore & {
	getSessions(): unknown;
};

export type ThemeFluxStore = FluxStore & {
	theme?: string;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Presence: PresenceFluxStore;
		Sessions: SessionsFluxStore;
	}
}

export const PresenceStore = flux.getStore('Presence', { lazy: true });
export const SessionsStore = flux.getStore('Sessions', { lazy: true });
export const ThemeStore: ThemeFluxStore = flux.getStore('Theme', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });
export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });

export const settings = storage.getBucket();
