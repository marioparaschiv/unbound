import { metro, patcher, storage } from '@unbound-app/api';

export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });
export const InvitePermissions = metro.findByProps('useInvitesDisabledPermission', { lazy: true });
export const GuildMemberStore = metro.findStore('GuildMember', { lazy: true });
export const ChannelStore = metro.findStore('Channel', { lazy: true });

export const settings = storage.getStore('unbound.show-hidden-things');

export const Patcher = patcher.createPatcher('unbound.show-hidden-things');
