import { metro, patcher, storage } from '@unbound-app/api';

export const UserStore = metro.stores.Users;
export const ChannelStore = metro.findStore('Channel', { lazy: true });
export const MessageStore = metro.findStore('Message', { lazy: true });
export const GuildMemberStore = metro.findStore('GuildMember', { lazy: true });
export const SelectedChannelStore = metro.findStore('SelectedChannel', { lazy: true });
export const RoleStore = metro.findByProps('getRole', 'getSortedRoles', { lazy: true });
export const RowGenerator = metro.findByProps('generateMessageRowData', { lazy: true });

export const settings = storage.getStore('unbound.mention-avatars');
export const Patcher = patcher.createPatcher('unbound.mention-avatars');
