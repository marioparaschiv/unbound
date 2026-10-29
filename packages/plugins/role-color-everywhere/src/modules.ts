import { metro, patcher, storage } from '@unbound-app/api';

import type { Channel, MemberStore, Message, Role, User } from '~/types';

type GuildRoleStore = {
	getRole(guildId: string, roleId: string): Role | null | undefined;
};

type UserStore = {
	getUser(userId: string): User | null | undefined;
};

type ChannelStore = {
	getChannel(channelId: string): Channel | null | undefined;
};

type MessageStore = {
	getMessage(channelId: string, messageId: string): Message | null | undefined;
};

type TypingStore = {
	getTypingUsers(channelId: string): Record<string, number> | null | undefined;
};

type RelationshipStore = {
	getNickname?(userId: string): string | null | undefined;
};

type SelectedChannelStore = {
	getChannelId(): string | undefined;
	addChangeListener(listener: () => void): void;
	removeChangeListener(listener: () => void): void;
};

export const GuildMemberStore = metro.findStore('GuildMember', { lazy: true }) as MemberStore;
export const GuildRoleStore = metro.findStore('GuildRole', { lazy: true }) as GuildRoleStore;
export const UserStore = metro.stores.Users as UserStore;
export const ChannelStore = metro.findStore('Channel', { lazy: true }) as ChannelStore;
export const MessageStore = metro.findStore('Message', { lazy: true }) as MessageStore;
export const TypingStore = metro.findStore('Typing', { lazy: true }) as TypingStore;

export const RelationshipStore = metro.findStore('Relationship', {
	lazy: true,
}) as RelationshipStore;

export const SelectedChannelStore = metro.findStore('SelectedChannel', {
	lazy: true,
}) as SelectedChannelStore;

export const byRowManager = metro.filters.byName('RowManager');

export const TYPING_INDICATOR_PATH = 'modules/chat/native/TypingIndicator.tsx';

export const USERS_FAST_LIST_PATH =
	'modules/main_tabs_v2/native/shared_components/user_list/UsersFastList.tsx';

export const MESSAGE_REACTIONS_CONTENT_PATH =
	'modules/reactions/native/MessageReactionsContent.tsx';

export const POLL_VOTES_ACTION_SHEET_PATH = 'modules/polls/native/PollVotesActionSheet.tsx';

export const VOICE_USER_NAME_ITEM_PATH = 'modules/guild_sidebar/native/VoiceUserNameItem.tsx';

export const settings = storage.getStore('unbound.role-color-everywhere');

export const Patcher = patcher.createPatcher('unbound.role-color-everywhere');
