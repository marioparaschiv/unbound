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

export const TypingIndicator = metro.findByFilePath('modules/chat/native/TypingIndicator.tsx', {
	interop: false,
	lazy: true,
});

export const UsersFastList = metro.findByFilePath(
	'modules/main_tabs_v2/native/shared_components/user_list/UsersFastList.tsx',
	{ interop: false, lazy: true },
);

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

export const settings = storage.getStore('unbound.role-color-everywhere');

export const Patcher = patcher.createPatcher('unbound.role-color-everywhere');
