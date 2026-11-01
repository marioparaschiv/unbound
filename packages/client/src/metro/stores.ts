import { findStoreLazy } from '~/metro/wrappers';

/** Discord's `AccessibilityStore` Flux store, holding the user's accessibility settings; found on first access. */
export const Accessibility = findStoreLazy('Accessibility');
/** Discord's `ThemeStore` Flux store, holding the theme Discord shows; found on first access. */
export const Theme = findStoreLazy('Theme');
/** Discord's `UserStore` Flux store, holding the users the client knows; found on first access. */
export const Users = findStoreLazy('User');
/** Discord's `GuildStore` Flux store, holding the servers the user is in; found on first access. */
export const Guilds = findStoreLazy('Guild');
