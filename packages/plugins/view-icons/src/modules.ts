import { metro, patcher } from '@unbound-app/api';

export { Media } from '@unbound-app/api/metro/components';

export const Patcher = patcher.createPatcher('unbound.view-icons');

export const IconUtils = metro.findByProps('getUserAvatarURL', 'getGuildIconURL', { lazy: true });
export const ActionSheetsFilter = metro.filters.byProps('openLazy', 'hideActionSheet');
export const ContextMenusFilter = metro.filters.byProps('showContextMenu', 'hideContextMenu');
// The same module as `metro.common.Theme`, which its typings do not declare yet.
export const Theme = metro.findByProps('colors', 'internal', { lazy: true });

export const ChannelStore = metro.findStore('Channel', { lazy: true });
export const GuildMemberStore = metro.findStore('GuildMember', { lazy: true });
export const UserProfileStore = metro.findStore('UserProfile', { lazy: true });
export const UserStore = metro.stores.Users;
export const GuildStore = metro.stores.Guilds;
