import { metro, flux } from '@unbound-app/api';

export { Media } from '@unbound-app/api/metro/components';

export const IconUtils = metro.findByProps('getUserAvatarURL', 'getGuildIconURL', { lazy: true });
export const ActionSheetsFilter = metro.filters.byProps('openLazy', 'hideActionSheet');
export const ContextMenusFilter = metro.filters.byProps('showContextMenu', 'hideContextMenu');
// The same module as `metro.common.Theme`, which its typings do not declare yet.
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });

export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const GuildMemberStore = flux.getStore('GuildMember', { lazy: true });
export const UserProfileStore = flux.getStore('UserProfile', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });
export const GuildStore = flux.getStore('Guild', { lazy: true });
