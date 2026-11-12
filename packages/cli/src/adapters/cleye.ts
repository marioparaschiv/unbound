import type {
	CommandDefinition,
	CommandError,
	CommandOutput,
} from '@unbound-app/debugger-protocol/registry';
import { command, type Command } from 'cleye';

import { commandError, failure, inputFailure, type FailedOutput } from '~/lib/command-error';
import { fieldToFlag, isArrayField, negatedFlags } from '~/lib/flags';
import { readStdin, isStdinPiped } from '~/lib/stdin';
import { createContext } from '~/lib/context';
import type { TObject } from '~/lib/schema';
import { safeParse } from '~/lib/schema';

/** The value that marks a positional as fed from stdin instead of the command line. */
const STDIN_MARKER = '-';

/** A raw command-line value as cleye produces it: a flag's value, or a variadic positional's strings. */
type CommandInputValue = string | number | boolean | string[] | undefined;

/** The raw command-line input, after cleye reads it and before the definition's schema validates it. */
type CommandInput = Record<string, CommandInputValue>;

// UNKNOWN: cleye types a flag's value as `unknown`; a flag only ever holds its scalar.
function inputValue(value: unknown): CommandInputValue {
	if (Array.isArray(value)) {
		return value.map(String);
	}

	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
		? value
		: undefined;
}

/**
 * @description Builds a cleye command from a registry definition: the properties named in
 * `cli.positionals` become positional parameters, every other schema property becomes a flag whose type
 * is derived from the schema field. The callback reads a missing required first positional from a
 * pipe, validates the
 * assembled input through the definition's schema, runs the handler, and exits `0`/`1`/`2` on
 * success, on-device failure, and connection or usage error respectively.
 * @param definition The command to adapt.
 * @returns A cleye `command()` ready to register on the CLI.
 */
export function toCleyeCommand(definition: CommandDefinition<TObject>): Command {
	const positionalNames = (definition.cli?.positionals ?? []).map(String);
	const properties = definition.schema.properties;

	const flags: Record<string, ReturnType<typeof fieldToFlag>> = {
		json: {
			type: Boolean,
			description: 'Print the raw result as JSON instead of the formatted transcript.',
			default: false,
		},
	};

	for (const [name, field] of Object.entries(properties)) {
		if (positionalNames.includes(name)) {
			continue;
		}

		flags[name] = fieldToFlag(field);
	}

	return command(
		{
			name: definition.name,
			description: definition.summary,
			parameters: positionalNames.map((name) =>
				isArrayField(properties[name]!) ? `[${name}...]` : `[${name}]`,
			),
			flags,
			help: { description: definition.description },
		},
		(parsed) => {
			const { json, ...flagInput } = parsed.flags;
			const input: CommandInput = {};

			for (const [name, value] of Object.entries(flagInput)) {
				input[name] = inputValue(value);
			}

			// A command that streams, such as `ubd check --watch`, declares `json` to print JSON itself.
			if (Object.hasOwn(properties, 'json')) {
				input.json = Boolean(json);
			}

			const booleans = Object.keys(flags).filter((name) => flags[name]!.type === Boolean);
			const { off, unmatched } = negatedFlags(parsed.unknownFlags, booleans);

			for (const name of off) input[name] = false;

			for (const name of unmatched) {
				process.stderr.write(`Ignoring unknown flag --${name}.\n`);
			}

			for (const name of positionalNames) {
				input[name] = inputValue(Reflect.get(parsed._, name));
			}

			// Only a required positional reads stdin: an optional one keeps its default under a non-TTY agent shell.
			const [first] = positionalNames;
			const stdinField =
				first && definition.schema.required?.includes(first) ? first : void 0;

			void run(definition, input, stdinField, Boolean(json));
		},
	);
}

// UNKNOWN: a command's data is whatever it chose to return.
function isPlainObject(value: unknown): value is object {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @description Shapes a failure for `--json`: `{ ok, text, error }`, or the command's data as before
 * with `error` added when the data is an object that has no `error` of its own.
 * @param output The failed output.
 * @returns What to print.
 */
// UNKNOWN: the command's own data passes through as it returned it.
export function failureJson(output: FailedOutput): unknown {
	const error: CommandError = commandError(output);
	const { data } = output;

	if (data === void 0) {
		return { ok: false, text: output.text, error };
	}

	return isPlainObject(data) && !Object.hasOwn(data, 'error') ? { ...data, error } : data;
}

/**
 * @description Ends the run on input the command cannot take: plain text on stderr, or the failure
 * as JSON on stdout under `--json`. Exits `2`, a usage error.
 * @param output The `invalid-input` failure.
 * @param json Whether the run asked for JSON.
 */
function invalidInput(output: FailedOutput, json: boolean): never {
	if (json) {
		process.stdout.write(`${JSON.stringify(failureJson(output))}\n`);
	} else {
		process.stderr.write(`${output.text}\n`);
	}

	process.exit(2);
}

async function run(
	definition: CommandDefinition<TObject>,
	input: CommandInput,
	stdinField: string | undefined,
	json: boolean,
) {
	if (stdinField && (input[stdinField] === void 0 || input[stdinField] === STDIN_MARKER)) {
		if (!isStdinPiped()) {
			const text = `Missing required argument: ${stdinField}.`;

			invalidInput(failure('invalid-input', text, { field: stdinField }), json);
		}

		input[stdinField] = await readStdin();
	}

	const parsed = safeParse(definition.schema, input);

	if (!parsed.success) {
		invalidInput(inputFailure(parsed.error), json);
	}

	// Commands that never dial the bridge have no `port`; their context is never connected.
	const { port } = parsed.data;
	const context = createContext(typeof port === 'number' ? port : Number.NaN);

	try {
		const output = await handle(definition, parsed.data, context, json);

		if (json) {
			const printed = output.ok ? (output.data ?? output) : failureJson(output);

			process.stdout.write(`${JSON.stringify(printed)}\n`);
		} else if (output.ok) {
			process.stdout.write(`${output.text}\n`);
		} else {
			process.stderr.write(`${output.text}\n`);
		}

		if (output.ok) {
			process.exit(0);
		}

		const connectionError = context.connected && !context.client.isDeviceConnected;

		process.exit(connectionError ? 2 : 1);
	} finally {
		context.close();
	}
}

/**
 * @description Runs the handler. Under `--json` a throw becomes a `command-failed` output with its
 * stack, so the reader still gets one JSON line; otherwise it propagates as before.
 */
async function handle(
	definition: CommandDefinition<TObject>,
	input: Parameters<CommandDefinition<TObject>['handler']>[0],
	context: ReturnType<typeof createContext>,
	json: boolean,
): Promise<CommandOutput> {
	try {
		return await definition.handler(input, context);
	} catch (error) {
		if (!json || !(error instanceof Error)) {
			throw error;
		}

		return failure('command-failed', error.message, error.stack ? { stack: error.stack } : {});
	}
}

export default toCleyeCommand;
