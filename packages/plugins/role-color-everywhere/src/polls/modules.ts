import { flux, metro } from '@unbound-app/api';

import type { MemberStore } from '~/types';

export const GuildMemberStore: MemberStore = flux.getStore('GuildMember');
export const ChannelStore = flux.getStore('Channel');

export const PollVotesActionSheet = metro.findByFilePath(
	'modules/polls/native/PollVotesActionSheet.tsx',
);
