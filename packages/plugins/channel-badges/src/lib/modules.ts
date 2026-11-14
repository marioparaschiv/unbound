import { metro } from '@unbound-app/api';

/** Discord's permission checks, which say whether @everyone may see a channel. */
export const PermissionUtils = metro.findByProps('computePermissions', 'canEveryoneRole', {
	lazy: true,
});

/** Discord's constants, which hold the permission bits. */
export const DiscordConstants = metro.findByProps('Permissions', 'ThemeTypes', { lazy: true });
