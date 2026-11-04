import { flux, metro } from '@unbound-app/api';

import type { MemberStore } from '~/types';

export const GuildMemberStore: MemberStore = flux.getStore('GuildMember');
export const ChannelStore = flux.getStore('Channel');

export const MessageReactionsContent = metro.findByFilePath(
	'modules/reactions/native/MessageReactionsContent.tsx',
);
