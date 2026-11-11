import { findStore } from '~/metro/lookups';

/** Discord's `AccessibilityStore` Flux store, holding the user's accessibility settings; found on first access. */
export const Accessibility = findStore('Accessibility');
/** Discord's `ThemeStore` Flux store, holding the theme Discord shows; found on first access. */
export const Theme = findStore('Theme');
/** Discord's `UserStore` Flux store, holding the users the client knows; found on first access. */
export const Users = findStore('User');
/** Discord's `GuildStore` Flux store, holding the servers the user is in; found on first access. */
export const Guilds = findStore('Guild');
