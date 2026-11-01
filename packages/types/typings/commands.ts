/** A Discord user, as the user store returns it. Only the fields commands rely on. */
export type CommandUser = {
	/** The user's Discord snowflake id. */
	id: string;
	/** The unique account name, without the `@`. */
	username: string;
	/** The display name the user set; `null` or absent when they set none. */
	globalName?: string | null;
	/** `true` for bot accounts. */
	bot?: boolean;
};

/** A Discord channel, as the channel store returns it. */
export type CommandChannel = {
	/** The channel's Discord snowflake id. */
	id: string;
	/** Discord's numeric channel type, such as `0` for a guild text channel or `1` for a DM. */
	type: number;
	/** The channel name; DMs may have none. */
	name?: string;
	/** The id of the guild the channel belongs to; `null` or absent for DMs and group DMs. */
	guild_id?: string | null;
};

/** A Discord guild. */
export type CommandGuild = {
	/** The guild's Discord snowflake id. */
	id: string;
	/** The guild's display name. */
	name: string;
};

/** A Discord guild role. */
export type CommandRole = {
	/** The role's Discord snowflake id. */
	id: string;
	/** The role's display name. */
	name: string;
	/** The role colour as a 24-bit RGB integer; `0` when the role has no colour. */
	color?: number;
};

/** Where a command runs. Discord never runs a command without a channel. */
export type CommandContext = {
	/** The channel the command was sent in. */
	channel: CommandChannel;
	/** The guild of that channel; `undefined` in DMs and group DMs. */
	guild: CommandGuild | undefined;
};

/** An option value as Discord passes it. User, channel and role options arrive as id strings. */
export type RawOptionValue = string | number | boolean;

/** What autocomplete sees: where it runs and the raw values of the other options filled in so far. */
export type AutocompleteContext = CommandContext & {
	values: Readonly<Record<string, RawOptionValue>>;
};

/** A value with the label the picker shows for it. */
export type ChoiceWithLabel<V extends string | number> = {
	/** The text the picker shows. Labels in one `option.choice` list must be unique. */
	label: string;
	/** The value the handler receives when this choice is picked. */
	value: V;
};

/** A choice or suggestion: a bare value, shown as itself, or a value with a label. */
export type Choice<V extends string | number> = V | ChoiceWithLabel<V>;

/** A value, or a promise of one. */
export type Awaitable<T> = T | Promise<T>;

/** Suggests values for an option while the user types. At most 25 are shown. */
export type Autocomplete<V extends string | number> = (
	query: string,
	context: AutocompleteContext,
) => Awaitable<readonly Choice<V>[]>;

/** A field of an embed in an ephemeral reply. */
export type ReplyEmbedField = {
	/** The field's heading. */
	name: string;
	/** The field's body text. */
	value: string;
	/** Lays the field out beside neighbouring inline fields instead of on its own row. */
	inline?: boolean;
};

/** An embed in an ephemeral reply. */
export type ReplyEmbed = {
	/** The heading at the top of the embed. */
	title?: string;
	/** The embed's body text, below the title. */
	description?: string;
	/** A link the title opens. */
	url?: string;
	/** The colour of the embed's side bar, as a 24-bit RGB integer such as `0x5865f2`. */
	color?: number;
	/** Name and value pairs shown below the description. */
	fields?: readonly ReplyEmbedField[];
};

/** Sent by Discord as a normal message from the user. */
export type PublicReply = {
	/** The message text. An empty string sends nothing. */
	content: string;
	/** Sends the message as text-to-speech. */
	tts?: boolean;
	/** Absent or `false`; `true` makes the reply an {@link EphemeralReply}. */
	ephemeral?: false;
};

/** Shown only to the user, as a bot message. */
export type EphemeralReply = {
	/** Marks the reply as shown only to the user instead of sent. */
	ephemeral: true;
	/** The message text; empty when absent. */
	content?: string;
	/** Embeds shown under the text. */
	embeds?: readonly ReplyEmbed[];
};

/** What `execute` returns. A string is shorthand for `{ content }`; nothing means the command did its own work. */
export type Reply = string | PublicReply | EphemeralReply | undefined | void;

/** An asset id from `assets.Icons`, or a `data:` or `https:` uri. */
export type IconSource = number | string;

/** A section of the `/` picker owned by one owner. */
export type SectionInput = {
	/** The section's heading in the picker; also the author name on its ephemeral replies. Must not be blank. */
	name: string;
	/** The section's icon and reply avatar. Omitted, Discord's default application command icon. */
	icon?: IconSource;
};

/** Options of `createCommands`. */
export type CommandsOptions = {
	/** The owner's own picker section. Omitted, commands go in the shared Unbound section. */
	section?: SectionInput;
};

/** Settings of `option.string`. */
export type StringOptionSettings = {
	/** The fewest characters Discord accepts for the value. */
	minLength?: number;
	/** The most characters Discord accepts for the value. */
	maxLength?: number;
	/** Suggests values while the user types; setting it turns on Discord's autocomplete for the option. */
	autocomplete?: Autocomplete<string>;
};

/** Settings of `option.integer` and `option.number`. */
export type NumberOptionSettings = {
	/** The smallest value Discord accepts, inclusive. */
	minValue?: number;
	/** The largest value Discord accepts, inclusive. */
	maxValue?: number;
	/** Suggests values while the user types; setting it turns on Discord's autocomplete for the option. */
	autocomplete?: Autocomplete<number>;
};

/** Settings of `option.channel`. */
export type ChannelOptionSettings = {
	/** Discord channel types the picker offers. */
	channelTypes?: readonly number[];
};

/** The settings of an option kind that takes none. */
type NoSettings = Record<never, never>;

/** Each option kind's handler value and builder settings. The client's kind table implements every key. */
export type OptionKindTypes = {
	/** Free text. */
	string: { value: string; settings: StringOptionSettings };
	/** A whole number; a fractional value fails the command. */
	integer: { value: number; settings: NumberOptionSettings };
	/** Any finite number. */
	number: { value: number; settings: NumberOptionSettings };
	/** True or false. */
	boolean: { value: boolean; settings: NoSettings };
	/** A user, resolved from the picked id through Discord's user store. */
	user: { value: CommandUser; settings: NoSettings };
	/** A channel, resolved from the picked id through Discord's channel store. */
	channel: { value: CommandChannel; settings: ChannelOptionSettings };
	/** A role of the current guild, resolved from the picked id through Discord's role store. */
	role: { value: CommandRole; settings: NoSettings };
};

/** The option kinds: one builder each on `option`. */
export type OptionKind = keyof OptionKindTypes;

/** The value a handler receives for a kind. */
export type OptionValue<K extends OptionKind> = OptionKindTypes[K]['value'];

/** The settings a kind's builder accepts beyond `description` and `required`. */
export type OptionSettings<K extends OptionKind> = OptionKindTypes[K]['settings'];

// Carries the parsed value type from a builder to `OptionArgs` without existing at runtime.
declare const valueType: unique symbol;

/** One declared option, made by an `option` builder. */
export type OptionSpec<
	K extends OptionKind = OptionKind,
	R extends boolean = boolean,
	V = OptionValue<K>,
> = {
	/** The option kind; `option.choice` derives it from its values. */
	readonly kind: K;
	/** Whether Discord requires the option. Defaults to `false`; required options are listed first. */
	readonly required: R;
	/** The text the picker shows for the option; `undefined` shows the option's name. */
	readonly description: string | undefined;
	/** The kind-specific settings given to the builder; empty for `option.choice`. */
	readonly settings: OptionSettings<K>;
	/** The allowed values from `option.choice`; `undefined` for every other builder. */
	readonly choices: readonly Choice<string | number>[] | undefined;
	/** Carries the handler's value type for inference only; never set at runtime. */
	readonly [valueType]?: V;
};

/** A handler's args, derived from its options: a required option is `V`, an optional one `V | undefined`. */
export type OptionArgs<O> = {
	[K in keyof O]: O[K] extends OptionSpec<OptionKind, infer R, infer V>
		? R extends true
			? V
			: V | undefined
		: never;
};

/**
 * A command that runs. `O` is inferred from `options` and types `execute`'s args.
 * `execute` uses method syntax so its parameter stays bivariant and the registry can hold it erased.
 */
export type LeafCommand<O> = {
	/** The text the picker shows under the command name, 1 to 100 characters. */
	description: string;
	/** The command's options keyed by name, made with the `option` builders. At most 25. */
	options?: O;
	/** Runs the command with the parsed options. A throw or rejection shows the user an ephemeral error. */
	execute(args: OptionArgs<O>, context: CommandContext): Awaitable<Reply>;
	/** Never set on a leaf; a command with `subcommands` is a {@link CommandGroup}. */
	subcommands?: never;
};

/** A command that only groups subcommands: `/root sub` or `/root group sub`. */
export type CommandGroup<S> = {
	/** The text the picker shows under the group name, 1 to 100 characters. */
	description: string;
	/** The group's commands keyed by name, 1 to 25 of them. */
	subcommands: CommandTree<S>;
	/** Never set on a group; only a {@link LeafCommand} takes options. */
	options?: never;
	/** Never set on a group; only a {@link LeafCommand} runs. */
	execute?: never;
};

/** A leaf or a group. */
export type CommandNode<T> = LeafCommand<T> | CommandGroup<T>;

/**
 * Commands keyed by name, at every level. TypeScript infers `T` per key by reversing this mapped type,
 * from `options` on a leaf and from `subcommands` on a group. A conditional type here breaks inference.
 */
export type CommandTree<T> = { [K in keyof T]: CommandNode<T[K]> };

/** The handle `createCommands` returns, scoped to one owner. */
export type CommandsHandle = {
	/**
	 * Adds commands. Registering a root name this owner already has replaces that whole command.
	 * Returns a function that removes this call's commands; it is safe to call twice or after a sweep.
	 */
	register<T>(commands: CommandTree<T>): () => void;
	/** Removes this owner's root command `name` with its subcommands. Does nothing when there is none. */
	unregister(name: string): void;
	/** Removes every command of this owner. */
	unregisterAll(): void;
};

/** Settings every builder accepts. */
export type BuilderInput<K extends OptionKind, R extends boolean> = OptionSettings<K> & {
	description?: string;
	required?: R;
};

/** Settings `option.choice` accepts. */
export type ChoiceInput<R extends boolean> = {
	/** The text the picker shows for the option, 1 to 100 characters. Omitted, the option's name. */
	description?: string;
	/** Whether Discord requires the option. Defaults to `false`. */
	required?: R;
};

/** One kind's builder. */
export type OptionBuilder<K extends OptionKind> = <const R extends boolean = false>(
	settings?: BuilderInput<K, R>,
) => OptionSpec<K, R>;

/** The kind a choice list maps to: strings are a string option, numbers an integer or number option. */
export type ChoiceKind<V extends string | number> = V extends string
	? 'string'
	: 'integer' | 'number';

/** The `option` builders: one per kind, plus `choice`. */
export type OptionBuilders = { [K in OptionKind]: OptionBuilder<K> } & {
	/**
	 * Restricts an option to listed values; the handler gets their literal union.
	 * @param choices Values, or `{ label, value }` pairs. 1 to 25, with unique labels.
	 * @param settings The option's description and whether it is required.
	 */
	choice<const V extends string | number, const R extends boolean = false>(
		choices: readonly Choice<V>[],
		settings?: ChoiceInput<R>,
	): OptionSpec<ChoiceKind<V>, R, V>;
};
