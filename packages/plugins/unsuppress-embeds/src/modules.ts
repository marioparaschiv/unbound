import type { FluxStore } from '@unbound-app/api/flux';
import { flux, metro } from '@unbound-app/api';

type PermissionStore = FluxStore & {
	can(permission: bigint, context: object): boolean;
};

export const { ActionSheets } = metro.api;
export const { REST, Constants } = metro.common;
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });
export const PermissionStore = flux.getStore('Permission', { lazy: true }) as PermissionStore;
