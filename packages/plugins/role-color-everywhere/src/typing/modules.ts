import { flux, metro } from '@unbound-app/api';

import type { MemberStore } from '~/types';

export const GuildMemberStore: MemberStore = flux.getStore('GuildMember');
export const UserStore = flux.getStore('User');
export const ChannelStore = flux.getStore('Channel');
export const TypingStore = flux.getStore('Typing');
export const RelationshipStore = flux.getStore('Relationship');
export const SelectedChannelStore = flux.getStore('SelectedChannel');

export const TypingIndicator = metro.findByFilePath('modules/chat/native/TypingIndicator.tsx');
