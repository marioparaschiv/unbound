import { metro, storage, flux } from '@unbound-app/api';

export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });
export const InvitePermissions = metro.findByProps('useInvitesDisabledPermission', { lazy: true });
export const GuildMemberStore = flux.getStore('GuildMember', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });

export const settings = storage.getBucket();
