import type { FluxStore } from '@unbound-app/api/flux';
import { metro, flux } from '@unbound-app/api';

import type { ClientStatusMap } from '~/lib/platforms';

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

export const PresenceStore = flux.getStore('Presence');
export const SessionsStore = flux.getStore('Sessions');
export const ThemeStore: ThemeFluxStore = flux.getStore('Theme');
export const UserStore = flux.getStore('User');
export const Theme = metro.common.Theme;
export const { i18n } = metro.common;
