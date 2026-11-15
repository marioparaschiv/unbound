import type { FluxStore } from '@unbound-app/api/flux';
import { flux, metro } from '@unbound-app/api';

type PermissionStore = FluxStore & {
	can(permission: bigint, context: object): boolean;
};

/** Discord's permission checks, which say whether @everyone may see a channel. */
export const PermissionUtils = metro.findByProps('computePermissions', 'canEveryoneRole', {
	lazy: true,
});

/** Discord's constants, which hold the permission bits. */
export const DiscordConstants = metro.findByProps('Permissions', 'ThemeTypes', { lazy: true });

export const PermissionStore = flux.getStore('Permission') as PermissionStore;
