import type { FluxStore } from '@unbound-app/api/flux';
import { metro, flux } from '@unbound-app/api';

import type { ClientStatusMap } from '~/indicators/platforms';

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
export const MessageRowData = metro.findByProps('generateMessageRowData');
export const UserRow = metro.findByFilePath(
	'modules/main_tabs_v2/native/shared_components/user_list/UserRow.tsx',
);
export const UserProfilePrimaryInfo = metro.findByFilePath(
	'modules/user_profile/native/UserProfilePrimaryInfo.tsx',
);
