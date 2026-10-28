import type {
	BuilderInput,
	Choice,
	CommandChannel,
	CommandContext,
	CommandRole,
	CommandUser,
	OptionBuilder,
	OptionBuilders,
	OptionKind,
	OptionSettings,
	OptionSpec,
	OptionValue,
	RawOptionValue,
} from '@unbound-app/types/commands';

/** Discord's ApplicationCommandOptionType values this API emits (build 349). */
export const OptionType = {
	SUB_COMMAND: 1,
	SUB_COMMAND_GROUP: 2,
	STRING: 3,
	INTEGER: 4,
	BOOLEAN: 5,
	USER: 6,
	CHANNEL: 7,
	ROLE: 8,
	NUMBER: 10,
} as const;

/** Looks up the records behind id options. Injected so the table stays pure. */
export type Resolvers = {
	user(id: string): CommandUser | undefined;
	channel(id: string): CommandChannel | undefined;
	role(guildId: string | undefined, id: string): CommandRole | undefined;
};

export type ParseInput = {
	value: RawOptionValue;
	context: CommandContext;
	resolvers: Resolvers;
};

/** The Discord option fields a kind's settings map to, in Discord's camelCase client shape. */
export type DiscordOptionExtras = {
	minLength?: number;
	maxLength?: number;
	minValue?: number;
	maxValue?: number;
	channelTypes?: readonly number[];
	autocomplete?: boolean;
};

/** One row of the kind table. */
export type OptionKindSpec<V, S> = {
	readonly type: number;
	/** Turns Discord's raw value into the handler's value; `undefined` when it cannot. */
	parse(input: ParseInput): V | undefined;
	toDiscord(settings: S): DiscordOptionExtras;
};

type KindTable = { readonly [K in OptionKind]: OptionKindSpec<OptionValue<K>, OptionSettings<K>> };

function toNumber(value: RawOptionValue): number | undefined {
	// Autocomplete hands a picked number back as the string the picker inserted.
	const number = typeof value === 'string' && value.trim() ? Number(value) : value;

	return typeof number === 'number' && Number.isFinite(number) ? number : undefined;
}

/**
 * THE option-kind table. Adding a kind is one row here plus its entry in `OptionKindTypes`; builders,
 * normalization and parsing read every per-kind difference from the row.
 */
const OptionKinds: KindTable = {
	string: {
		type: OptionType.STRING,
		parse: ({ value }) => (typeof value === 'string' ? value : undefined),
		toDiscord: ({ minLength, maxLength, autocomplete }) => ({
			minLength,
			maxLength,
			autocomplete: Boolean(autocomplete),
		}),
	},
	integer: {
		type: OptionType.INTEGER,
		parse: ({ value }) => {
			const number = toNumber(value);

			return Number.isInteger(number) ? number : undefined;
		},
		toDiscord: ({ minValue, maxValue, autocomplete }) => ({
			minValue,
			maxValue,
			autocomplete: Boolean(autocomplete),
		}),
	},
	number: {
		type: OptionType.NUMBER,
		parse: ({ value }) => toNumber(value),
		toDiscord: ({ minValue, maxValue, autocomplete }) => ({
			minValue,
			maxValue,
			autocomplete: Boolean(autocomplete),
		}),
	},
	boolean: {
		type: OptionType.BOOLEAN,
		parse: ({ value }) => (typeof value === 'boolean' ? value : undefined),
		toDiscord: () => ({}),
	},
	user: {
		type: OptionType.USER,
		parse: ({ value, resolvers }) => resolvers.user(String(value)),
		toDiscord: () => ({}),
	},
	channel: {
		type: OptionType.CHANNEL,
		parse: ({ value, resolvers }) => resolvers.channel(String(value)),
		toDiscord: ({ channelTypes }) => ({ channelTypes }),
	},
	role: {
		type: OptionType.ROLE,
		parse: ({ value, context, resolvers }) => resolvers.role(context.guild?.id, String(value)),
		toDiscord: () => ({}),
	},
};

/** A table row with its kind erased, for code that handles every kind alike. */
export type ErasedKindSpec = OptionKindSpec<OptionValue<OptionKind>, OptionSettings<OptionKind>>;

/**
 * @description Reads one kind's row off the table.
 * @param kind The option kind.
 * @returns The row, or `undefined` for a kind the table does not have.
 */
export function getKind(kind: string): ErasedKindSpec | undefined {
	return Object.hasOwn(OptionKinds, kind) ? OptionKinds[kind as OptionKind] : undefined;
}

function choiceKind(choices: readonly Choice<string | number>[]): OptionKind {
	const values = choices.map((choice) => (typeof choice === 'object' ? choice.value : choice));

	if (values.every((value) => typeof value === 'number')) {
		return values.every((value) => Number.isInteger(value)) ? 'integer' : 'number';
	}

	return 'string';
}

function createBuilder<K extends OptionKind>(kind: K): OptionBuilder<K> {
	function build<const R extends boolean = false>(
		input: BuilderInput<K, R> = {},
	): OptionSpec<K, R> {
		const { description, required = false, ...settings } = input;

		return Object.freeze({
			kind,
			required,
			description,
			settings,
			choices: undefined,
		}) as OptionSpec<K, R>;
	}

	return build;
}

function createBuilders(): OptionBuilders {
	const builders: Record<string, OptionBuilder<OptionKind>> = {};

	for (const kind of Object.keys(OptionKinds) as OptionKind[]) {
		builders[kind] = createBuilder(kind);
	}

	function choice(
		choices: readonly Choice<string | number>[],
		{ description, required = false }: ChoiceSettings = {},
	): OptionSpec {
		return Object.freeze({
			kind: choiceKind(choices),
			required,
			description,
			settings: {},
			choices: Object.freeze([...choices]),
		});
	}

	return Object.freeze({ ...builders, choice }) as OptionBuilders;
}

type ChoiceSettings = {
	description?: string;
	required?: boolean;
};

/** The option builders: `option.string({ required: true })`, `option.user()`, `option.choice([...])`. */
export const option: OptionBuilders = createBuilders();
