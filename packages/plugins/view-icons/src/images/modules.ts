import { flux, metro } from '@unbound-app/api';

export { Media } from '@unbound-app/api/metro/components';

export const IconUtils = metro.findByProps('getUserAvatarURL', 'getGuildIconURL');
export const ActionSheets = metro.findByProps('openLazy', 'hideActionSheet');
export const ContextMenus = metro.findByProps('showContextMenu', 'hideContextMenu');
export const Theme = metro.common.Theme;

export const ChannelStore = flux.getStore('Channel');
export const GuildMemberStore = flux.getStore('GuildMember');
export const UserProfileStore = flux.getStore('UserProfile');
export const UserStore = flux.getStore('User');
export const GuildStore = flux.getStore('Guild');
