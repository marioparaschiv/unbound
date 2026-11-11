import { metro } from '@unbound-app/api';

// Shared by the tag patch, which checks them, and `resolveTag`, which reads them.
export const DiscordConstants = metro.findByProps('Permissions', 'ThemeTypes');
export const PermissionUtils = metro.findByProps('computePermissions', 'canEveryoneRole');
