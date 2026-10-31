import { metro, flux } from '@unbound-app/api';

export const { ActionSheets } = metro.api;
export const ContextMenusFilter = metro.filters.byProps('showContextMenu', 'hideContextMenu');
// The same module as `metro.common.Theme`, which its typings do not declare yet.
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });

export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const UserProfileStore = flux.getStore('UserProfile', { lazy: true });
export const { Clipboard } = metro.common;
export const UserStore = flux.getStore('User', { lazy: true });
export const GuildStore = flux.getStore('Guild', { lazy: true });
