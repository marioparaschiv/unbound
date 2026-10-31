import type { LiteralUnion } from './utils';

/** Runs after a Flux store's state changed. */
export type FluxChangeListener = () => void;

/** The members every Flux store has. A store name missing from {@link FluxStores} gets this type. */
export type FluxStore = {
	getName(): string;
	addChangeListener(listener: FluxChangeListener): void;
	removeChangeListener(listener: FluxChangeListener): void;
	emitChange(): void;
};

/** A Discord user record. */
export type FluxUser = {
	id: string;
	username: string;
	globalName: string | null;
	discriminator: string;
	avatar: string | null;
	bot: boolean;
};

/** A Discord guild record. */
export type FluxGuild = {
	id: string;
	name: string;
	icon: string | null;
	ownerId: string;
};

/** A guild member record. */
export type FluxGuildMember = {
	userId: string;
	guildId: string;
	nick: string | null;
	roles: string[];
	colorString: string | null;
};

/** A Discord channel record. */
export type FluxChannel = {
	id: string;
	type: number;
	name: string;
	guild_id: string | null;
};

/** A Discord message record. */
export type FluxMessage = {
	id: string;
	channel_id: string;
	content: string;
	author: FluxUser;
};

/** A user's profile, loaded when their profile is opened. */
export type FluxUserProfile = {
	userId: string;
	bio: string;
	pronouns: string;
};

/** Discord's `UserStore`. */
export type UserStore = FluxStore & {
	getCurrentUser(): FluxUser | undefined;
	getUser(id: string): FluxUser | undefined;
	getUsers(): Record<string, FluxUser>;
};

/** Discord's `GuildStore`. */
export type GuildStore = FluxStore & {
	getGuild(id: string): FluxGuild | undefined;
	getGuilds(): Record<string, FluxGuild>;
	getGuildCount(): number;
};

/** Discord's `GuildMemberStore`. */
export type GuildMemberStore = FluxStore & {
	getMember(guildId: string, userId: string): FluxGuildMember | null;
	getMembers(guildId: string): FluxGuildMember[];
	getNick(guildId: string, userId: string): string | null;
	isMember(guildId: string, userId: string): boolean;
};

/** Discord's `ChannelStore`. */
export type ChannelStore = FluxStore & {
	getChannel(id: string): FluxChannel | undefined;
	hasChannel(id: string): boolean;
	getDMFromUserId(userId: string): string | undefined;
};

/** Discord's `SelectedChannelStore`. */
export type SelectedChannelStore = FluxStore & {
	getChannelId(guildId?: string): string | undefined;
	getLastSelectedChannelId(guildId?: string): string | undefined;
	getVoiceChannelId(): string | null;
};

/** Discord's `TypingStore`. */
export type TypingStore = FluxStore & {
	/** Maps the id of each user typing in the channel to when they started. */
	getTypingUsers(channelId: string): Record<string, number>;
	isTyping(channelId: string, userId: string): boolean;
};

/** Discord's `RelationshipStore`. */
export type RelationshipStore = FluxStore & {
	isFriend(userId: string): boolean;
	isBlocked(userId: string): boolean;
	isIgnored(userId: string): boolean;
	getNickname(userId: string): string | undefined;
	getRelationshipType(userId: string): number;
	getFriendIDs(): string[];
};

/** Discord's `UserProfileStore`. */
export type UserProfileStore = FluxStore & {
	getUserProfile(userId: string): FluxUserProfile | undefined;
	getGuildMemberProfile(userId: string, guildId: string): FluxUserProfile | undefined;
};

/** Discord's `GuildSettingsStore`, the state of the open server settings screen. */
export type GuildSettingsStore = FluxStore & {
	getGuildId(): string | undefined;
	isOpen(): boolean;
	hasChanges(): boolean;
};

/**
 * The Flux stores `flux.getStore` knows, keyed by name without the `Store` suffix. Add your own with
 * `declare module '@unbound-app/api/flux' { interface FluxStores { Message: MessageStore } }`.
 */
// oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
export interface FluxStores {
	User: UserStore;
	Guild: GuildStore;
	GuildMember: GuildMemberStore;
	Channel: ChannelStore;
	SelectedChannel: SelectedChannelStore;
	Typing: TypingStore;
	Relationship: RelationshipStore;
	UserProfile: UserProfileStore;
	GuildSettings: GuildSettingsStore;
}

/** A store name: one of {@link FluxStores}, or any other string. */
export type FluxStoreName = LiteralUnion<Extract<keyof FluxStores, string>>;

/** The store type `flux.getStore(name)` returns: its {@link FluxStores} entry, else {@link FluxStore}. */
export type FluxStoreOf<K extends string> = K extends keyof FluxStores ? FluxStores[K] : FluxStore;

/** Options for `flux.getStore`. */
export type GetStoreOptions = {
	/** Search on first property access instead of at once. Defaults to `true`. */
	lazy?: boolean;
	/** Append `Store` to the name before matching. Defaults to `true`. */
	short?: boolean;
};

/**
 * The payload of each Flux action, keyed by action type. Add your own with
 * `declare module '@unbound-app/api/flux' { interface FluxActions { MY_ACTION: { id: string } } }`.
 */
// oxlint-disable-next-line typescript/consistent-type-definitions -- declaration merging needs an interface
export interface FluxActions {
	MESSAGE_CREATE: {
		channelId: string;
		guildId?: string;
		message: FluxMessage;
		optimistic: boolean;
	};
	MESSAGE_UPDATE: { guildId?: string; message: FluxMessage };
	MESSAGE_DELETE: { id: string; channelId: string; guildId?: string };
	CHANNEL_SELECT: { channelId?: string; guildId?: string; messageId?: string };
	TYPING_START: { channelId: string; userId: string };
	TYPING_STOP: { channelId: string; userId: string };
	CONNECTION_OPEN: { user: FluxUser };
}

/** An action type: one of {@link FluxActions}, or any other string. */
export type FluxActionType = LiteralUnion<Extract<keyof FluxActions, string>>;

/** The base shape of every Flux action. */
export type FluxAction<T extends string = string> = { type: T };

/** The action Discord dispatches for type `K`: its {@link FluxActions} payload, else {@link FluxAction}. */
export type FluxActionOf<K extends string> = K extends keyof FluxActions
	? FluxAction<K> & FluxActions[K]
	: FluxAction<K>;

/** Runs for each dispatched action of one type. */
export type FluxActionListener<K extends string> = (action: FluxActionOf<K>) => void;

/** Runs before Discord handles an action of one type. Returning `true` drops the action. */
export type FluxActionInterceptor<K extends string> = (action: FluxActionOf<K>) => boolean | void;
