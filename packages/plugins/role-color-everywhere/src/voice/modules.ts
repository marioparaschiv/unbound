import { flux, metro } from '@unbound-app/api';

import type { MemberStore } from '~/types';

export const GuildMemberStore: MemberStore = flux.getStore('GuildMember');

export const VoiceUserNameItem = metro.findByFilePath(
	'modules/guild_sidebar/native/VoiceUserNameItem.tsx',
);
