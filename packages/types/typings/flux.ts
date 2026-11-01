import type { LiteralUnion } from './utils';

/** Runs after a Flux store's state changed. */
export type FluxChangeListener = () => void;

/** The members every Flux store has. A store name missing from {@link FluxStores} gets this type. */
export type FluxStore = {
	/** Returns the store's name, such as `UserStore`. */
	getName(): string;
	/** Calls `listener` after every change to the store's state, until it is removed. */
	addChangeListener(listener: FluxChangeListener): void;
	/** Stops calling a listener added with `addChangeListener`. */
	removeChangeListener(listener: FluxChangeListener): void;
	/** Calls every change listener now. Discord calls it after the store handles an action. */
	emitChange(): void;
};

/** A Discord user record. */
export type FluxUser = {
	/** The user's Discord snowflake id. */
	id: string;
	/** The unique account name, without the `@`. */
	username: string;
	/** The display name the user set; `null` when they set none. */
	globalName: string | null;
	/** The legacy four-digit tag; `'0'` for accounts on unique usernames. */
	discriminator: string;
	/** The avatar image hash; `null` when the user has the default avatar. */
	avatar: string | null;
	/** `true` for bot accounts. */
	bot: boolean;
};

/** A Discord guild record. */
export type FluxGuild = {
	/** The guild's Discord snowflake id. */
	id: string;
	/** The guild's display name. */
	name: string;
	/** The guild icon's image hash; `null` when the guild has no icon. */
	icon: string | null;
	/** The id of the user who owns the guild. */
	ownerId: string;
};

/** A guild member record. */
export type FluxGuildMember = {
	/** The id of the member's user. */
	userId: string;
	/** The id of the guild this membership is in. */
	guildId: string;
	/** The member's nickname in this guild; `null` when they have none. */
	nick: string | null;
	/** The ids of the member's roles in this guild. */
	roles: string[];
	/** The member's name colour as a hex string from their roles; `null` when no role gives one. */
	colorString: string | null;
};

/** A Discord channel record. */
export type FluxChannel = {
	/** The channel's Discord snowflake id. */
	id: string;
	/** Discord's numeric channel type, such as `0` for a guild text channel or `1` for a DM. */
	type: number;
	/** The channel name; DMs may have an empty one. */
	name: string;
	/** The id of the guild the channel belongs to; `null` for DMs and group DMs. */
	guild_id: string | null;
};

/** A Discord message record. */
export type FluxMessage = {
	/** The message's Discord snowflake id. */
	id: string;
	/** The id of the channel the message is in. */
	channel_id: string;
	/** The raw Markdown text of the message; empty for a message with only attachments or embeds. */
	content: string;
	/** The user who sent the message. */
	author: FluxUser;
};

/** A user's profile, loaded when their profile is opened. */
export type FluxUserProfile = {
	/** The id of the user the profile belongs to. */
	userId: string;
	/** The profile's About Me text, as Markdown. */
	bio: string;
	/** The pronouns the user set, as free text. */
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
	/** Users Discord has loaded, including the signed-in user. */
	User: UserStore;
	/** Guilds the signed-in user is in. */
	Guild: GuildStore;
	/** Members of each guild, as far as Discord has loaded them. */
	GuildMember: GuildMemberStore;
	/** Channels Discord has loaded, guild channels and DMs alike. */
	Channel: ChannelStore;
	/** Which channel is open, per guild. */
	SelectedChannel: SelectedChannelStore;
	/** Who is typing in each channel. */
	Typing: TypingStore;
	/** Friends, blocks and friend nicknames of the signed-in user. */
	Relationship: RelationshipStore;
	/** Profiles of users whose profile has been opened. */
	UserProfile: UserProfileStore;
	/** The state of the open server settings screen. */
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
	/** A message arrived or was sent; `optimistic` is `true` for the local copy before Discord confirms it. */
	MESSAGE_CREATE: {
		channelId: string;
		guildId?: string;
		message: FluxMessage;
		optimistic: boolean;
	};
	/** A message was edited, or Discord filled in its embeds. */
	MESSAGE_UPDATE: { guildId?: string; message: FluxMessage };
	/** The message `id` in `channelId` was deleted. */
	MESSAGE_DELETE: { id: string; channelId: string; guildId?: string };
	/** The user opened a channel; `messageId` is set when they jumped to a message. */
	CHANNEL_SELECT: { channelId?: string; guildId?: string; messageId?: string };
	/** A user started typing in a channel. */
	TYPING_START: { channelId: string; userId: string };
	/** A user stopped typing in a channel. */
	TYPING_STOP: { channelId: string; userId: string };
	/** The gateway connection is ready; `user` is the signed-in user. */
	CONNECTION_OPEN: { user: FluxUser };
}

/** An action type: one of {@link FluxActions}, or any other string. */
export type FluxActionType = LiteralUnion<Extract<keyof FluxActions, string>>;

/** The base shape of every Flux action. */
export type FluxAction<T extends string = string> = {
	/** The action type, such as `MESSAGE_CREATE`; it picks the payload from {@link FluxActions}. */
	type: T;
};

/** The action Discord dispatches for type `K`: its {@link FluxActions} payload, else {@link FluxAction}. */
export type FluxActionOf<K extends string> = K extends keyof FluxActions
	? FluxAction<K> & FluxActions[K]
	: FluxAction<K>;

/** Runs for each dispatched action of one type. */
export type FluxActionListener<K extends string> = (action: FluxActionOf<K>) => void;

/** Runs before Discord handles an action of one type. Returning `true` drops the action. */
export type FluxActionInterceptor<K extends string> = (action: FluxActionOf<K>) => boolean | void;
