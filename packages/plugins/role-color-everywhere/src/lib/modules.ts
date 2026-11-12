import { flux } from '@unbound-app/api';

import type { MemberStore } from '~/lib/types';

export const GuildMemberStore: MemberStore = flux.getStore('GuildMember');
export const GuildRoleStore = flux.getStore('GuildRole');
export const UserStore = flux.getStore('User');
export const ChannelStore = flux.getStore('Channel');
export const MessageStore = flux.getStore('Message');
export const SelectedChannelStore = flux.getStore('SelectedChannel');
export const TypingStore = flux.getStore('Typing');
export const RelationshipStore = flux.getStore('Relationship');
