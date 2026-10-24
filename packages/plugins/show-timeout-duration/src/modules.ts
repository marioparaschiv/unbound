import { metro, patcher } from '@unbound-app/api';

export const MessageRowData = metro.findByProps('generateMessageRowData', { lazy: true });
export const GuildMemberStore = metro.findStore('GuildMember', { lazy: true });
export const ChannelStore = metro.findStore('Channel', { lazy: true });

export const Patcher = patcher.createPatcher('unbound.show-timeout-duration');
