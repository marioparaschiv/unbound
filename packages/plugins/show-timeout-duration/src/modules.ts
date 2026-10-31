import { metro, flux } from '@unbound-app/api';

export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });
export const GuildMemberStore = flux.getStore('GuildMember', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });
