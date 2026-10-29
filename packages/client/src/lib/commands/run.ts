import type {
	Choice,
	CommandChannel,
	CommandContext,
	CommandGuild,
	EphemeralReply,
	OptionKind,
	OptionValue,
	PublicReply,
	RawOptionValue,
	Reply,
} from '@unbound-app/types/commands';

import type { CommandRecord, ErasedArgs, Section } from '~/lib/commands/normalize';
import { OptionType, getKind } from '~/lib/commands/options';
import type { Resolvers } from '~/lib/commands/options';

/** An option node as Discord's executeCommand passes it to `execute`. Groups and subcommands nest. */
export type RawOption = {
	type: number;
	name: string;
	value?: RawOptionValue;
	focused?: boolean;
	options?: RawOption[];
};

export type AutocompleteRequest = {
	name: string;
	query: string;
};

/** The second argument executeCommand passes to `execute`. */
export type DiscordContext = {
	channel: CommandChannel;
	guild?: CommandGuild | null;
	autocomplete?: AutocompleteRequest;
};

/** The `execute` Discord calls. Discord sends a returned reply publicly as the user. */
export type DiscordExecute = (
	options: RawOption[],
	context: DiscordContext,
) => Promise<PublicReply | undefined>;

export type AutocompleteWireChoice = {
	name: string;
	value: string | number;
};

export type AutocompleteRequestAction = {
	type: 'APPLICATION_COMMAND_AUTOCOMPLETE_REQUEST';
	nonce: string;
	channelId: string;
	query: string;
	name: string;
	contextKey: string;
};

export type AutocompleteResponseAction = {
	type: 'APPLICATION_COMMAND_AUTOCOMPLETE_RESPONSE';
	nonce: string;
	choices: AutocompleteWireChoice[];
};

export type AutocompleteAction = AutocompleteRequestAction | AutocompleteResponseAction;

/** Everything a command needs from Discord, injected by the commands built-in and by tests. */
export type CommandEffects = {
	resolvers: Resolvers;
	/** Shows a bot message only the user sees. */
	showEphemeral(channelId: string, reply: EphemeralReply, section: Section): void;
	dispatch(action: AutocompleteAction): void;
	nonce(): string;
	// UNKNOWN: whatever an author's handler threw.
	reportError(record: CommandRecord, error: unknown): void;
};

type ParsedArgs = { ok: true; args: ErasedArgs } | { ok: false; message: string };

const MAX_SUGGESTIONS = 25;

/**
 * @description Builds the `execute` Discord calls for one record. An autocomplete call answers suggestions
 * and never runs the handler. It never throws and never rejects.
 * @param record The record.
 * @param effects The Discord side effects.
 * @returns The Discord execute.
 */
export function createExecute(record: CommandRecord, effects: CommandEffects): DiscordExecute {
	return async (raw, discordContext) => {
		const context: CommandContext = {
			channel: discordContext.channel,
			guild: discordContext.guild ?? undefined,
		};
		const options = leafOptions(raw ?? []);

		if (discordContext.autocomplete) {
			await answerAutocomplete(
				record,
				options,
				discordContext.autocomplete,
				context,
				effects,
			);

			return;
		}

		try {
			const parsed = parseArgs(record, options, context, effects.resolvers);

			if (!parsed.ok) {
				effects.showEphemeral(
					context.channel.id,
					{
						ephemeral: true,
						content: `/${record.path.join(' ')} failed: ${parsed.message}`,
					},
					record.section,
				);

				return;
			}

			return route(await record.execute(parsed.args, context), record, context, effects);
		} catch (error) {
			fail(record, error, context, effects);
		}
	};
}

function route(
	reply: Reply,
	record: CommandRecord,
	context: CommandContext,
	effects: CommandEffects,
): PublicReply | undefined {
	if (!reply) return;

	if (typeof reply === 'string') {
		return { content: reply };
	}

	if (reply.ephemeral) {
		effects.showEphemeral(context.channel.id, reply, record.section);

		return;
	}

	if (!reply.content) return;

	return { content: reply.content, tts: reply.tts };
}

// UNKNOWN: a handler can throw anything.
function fail(
	record: CommandRecord,
	error: unknown,
	context: CommandContext,
	effects: CommandEffects,
) {
	const message = error instanceof Error ? error.message : String(error);

	try {
		effects.reportError(record, error);
		effects.showEphemeral(
			context.channel.id,
			{ ephemeral: true, content: `/${record.path.join(' ')} failed: ${message}` },
			record.section,
		);
	} catch {
		// Discord's send path has no catch, so a rejection here would surface as an unhandled one.
	}
}

async function answerAutocomplete(
	record: CommandRecord,
	options: RawOption[],
	request: AutocompleteRequest,
	context: CommandContext,
	effects: CommandEffects,
) {
	const nonce = effects.nonce();
	let choices: AutocompleteWireChoice[] = [];

	try {
		// The store drops a RESPONSE whose nonce no REQUEST registered.
		effects.dispatch({
			type: 'APPLICATION_COMMAND_AUTOCOMPLETE_REQUEST',
			nonce,
			channelId: context.channel.id,
			query: request.query,
			name: request.name,
			contextKey: contextKey(options),
		});

		const spec = record.options.find((option) => option.name === request.name);
		const values = Object.fromEntries(
			options
				.filter((option) => !option.focused && option.value !== undefined)
				.map((option) => [option.name, option.value as RawOptionValue]),
		);
		const suggestions = await spec?.autocomplete?.(request.query, { ...context, values });

		choices = (suggestions ?? []).slice(0, MAX_SUGGESTIONS).map(toWireChoice);
	} catch (error) {
		effects.reportError(record, error);
	}

	try {
		effects.dispatch({ type: 'APPLICATION_COMMAND_AUTOCOMPLETE_RESPONSE', nonce, choices });
	} catch (error) {
		effects.reportError(record, error);
	}
}

function toWireChoice(choice: Choice<string | number>): AutocompleteWireChoice {
	return typeof choice === 'object'
		? { name: choice.label, value: choice.value }
		: { name: String(choice), value: choice };
}

/**
 * @description Builds the autocomplete context key the way Discord does, from the non-focused options.
 * @param options The leaf options.
 * @returns The key; it changes only when another option's value changes.
 */
export function contextKey(options: RawOption[]): string {
	return options
		.filter((option) => !option.focused)
		.map((option) => `${option.name}=${String(option.value)}\0`)
		.join('');
}

/**
 * @description Descends through the subcommand and group nodes executeCommand wraps around a leaf's options.
 * @param options The options executeCommand passed.
 * @returns The leaf's own options.
 */
function leafOptions(options: RawOption[]): RawOption[] {
	let current = options;

	while (
		current.length === 1 &&
		(current[0].type === OptionType.SUB_COMMAND ||
			current[0].type === OptionType.SUB_COMMAND_GROUP)
	) {
		current = current[0].options ?? [];
	}

	return current;
}

function parseArgs(
	record: CommandRecord,
	options: RawOption[],
	context: CommandContext,
	resolvers: Resolvers,
): ParsedArgs {
	const args: Record<string, OptionValue<OptionKind> | undefined> = {};

	for (const spec of record.options) {
		const raw = options.find((option) => option.name === spec.name)?.value;
		const value =
			raw === undefined
				? undefined
				: getKind(spec.kind)?.parse({ value: raw, context, resolvers });

		if (raw !== undefined && value === undefined) {
			return { ok: false, message: `couldn't find the ${spec.kind} for ${spec.name}.` };
		}

		if (value === undefined && spec.required) {
			return { ok: false, message: `${spec.name} is required.` };
		}

		args[spec.name] = value;
	}

	return { ok: true, args };
}
