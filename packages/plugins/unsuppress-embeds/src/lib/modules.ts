import type { FluxStore } from '@unbound-app/api/flux';
import { flux, metro } from '@unbound-app/api';

type PermissionStore = FluxStore & {
	can(permission: bigint, context: object): boolean;
};

export const { REST, Constants } = metro.common;
export const ChannelStore = flux.getStore('Channel');
export const UserStore = flux.getStore('User');
export const PermissionStore = flux.getStore('Permission') as PermissionStore;
