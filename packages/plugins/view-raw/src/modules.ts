import { metro, patcher } from '@unbound-app/api';

export const Patcher = patcher.createPatcher('unbound.view-raw');

export const { ActionSheets } = metro.api;
export const ContextMenusFilter = metro.filters.byProps('showContextMenu', 'hideContextMenu');
// The same module as `metro.common.Theme`, which its typings do not declare yet.
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });

export const ChannelStore = metro.findStore('Channel', { lazy: true });
export const UserProfileStore = metro.findStore('UserProfile', { lazy: true });
export const { Clipboard } = metro.common;
export const UserStore = metro.stores.Users;
export const GuildStore = metro.stores.Guilds;
