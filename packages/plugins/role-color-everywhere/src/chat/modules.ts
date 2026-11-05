import { flux, metro } from '@unbound-app/api';

import type { MemberStore } from '~/types';

export const GuildMemberStore: MemberStore = flux.getStore('GuildMember');
export const UserStore = flux.getStore('User');
export const ChannelStore = flux.getStore('Channel');
export const MessageStore = flux.getStore('Message');
export const SelectedChannelStore = flux.getStore('SelectedChannel');

export const byRowManager = metro.filters.byName('RowManager');
