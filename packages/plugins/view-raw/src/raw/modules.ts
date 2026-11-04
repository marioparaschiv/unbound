import { flux, metro } from '@unbound-app/api';

export const ActionSheets = metro.findByProps('openLazy', 'hideActionSheet');
export const ContextMenus = metro.findByProps('showContextMenu', 'hideContextMenu');

export const ChannelStore = flux.getStore('Channel');
export const UserProfileStore = flux.getStore('UserProfile');
export const UserStore = flux.getStore('User');
export const GuildStore = flux.getStore('Guild');
