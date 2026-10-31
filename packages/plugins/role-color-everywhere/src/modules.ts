import { metro, storage, flux } from '@unbound-app/api';

import type { MemberStore } from '~/types';

export const GuildMemberStore: MemberStore = flux.getStore('GuildMember', { lazy: true });
export const GuildRoleStore = flux.getStore('GuildRole', { lazy: true });
export const UserStore = flux.getStore('User', { lazy: true });
export const ChannelStore = flux.getStore('Channel', { lazy: true });
export const MessageStore = flux.getStore('Message', { lazy: true });
export const ReferencedMessageStore = flux.getStore('ReferencedMessage', { lazy: true });
export const TypingStore = flux.getStore('Typing', { lazy: true });
export const RelationshipStore = flux.getStore('Relationship', { lazy: true });
export const SelectedChannelStore = flux.getStore('SelectedChannel', { lazy: true });

export const byRowManager = metro.filters.byName('RowManager');

export const TYPING_INDICATOR_PATH = 'modules/chat/native/TypingIndicator.tsx';

export const USERS_FAST_LIST_PATH =
	'modules/main_tabs_v2/native/shared_components/user_list/UsersFastList.tsx';

export const MessageReactionsContent = metro.findByFilePath(
	'modules/reactions/native/MessageReactionsContent.tsx',
	{ interop: false, lazy: true },
);

export const PollVotesActionSheet = metro.findByFilePath(
	'modules/polls/native/PollVotesActionSheet.tsx',
	{ interop: false, lazy: true },
);

export const VoiceUserNameItem = metro.findByFilePath(
	'modules/guild_sidebar/native/VoiceUserNameItem.tsx',
	{ interop: false, lazy: true },
);

export const settings = storage.getBucket();
