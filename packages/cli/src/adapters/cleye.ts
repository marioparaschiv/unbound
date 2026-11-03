import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { command, type Command } from 'cleye';

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
 * is derived from the schema field. The callback reads a stdin-fed positional when piped, validates the
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
			description: definition.description,
			parameters: positionalNames.map((name) =>
				isArrayField(properties[name]!) ? `[${name}...]` : `[${name}]`,
			),
			flags,
			// Tools under `ubd mcp` run through a second cleye instance, whose usage line would drop `mcp`.
			help: {
				description: firstSentence(definition.description),
				...(definition.surfaces.cli === 'mcp'
					? {
							usage: ['ubd mcp', definition.name, '[flags...]']
								.concat(positionalNames.map((name) => `[${name}]`))
								.join(' '),
						}
					: {}),
			},
		},
		(parsed) => {
			const { json, ...flagInput } = parsed.flags;
			const input: CommandInput = {};

			for (const [name, value] of Object.entries(flagInput)) {
				input[name] = inputValue(value);
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

			void run(definition, input, positionalNames[0], Boolean(json));
		},
	);
}

function firstSentence(description: string) {
	return description.match(/^.*?\.(?=\s|$)/s)?.[0] ?? description;
}

async function run(
	definition: CommandDefinition<TObject>,
	input: CommandInput,
	stdinField: string | undefined,
	json: boolean,
) {
	if (stdinField && (input[stdinField] === void 0 || input[stdinField] === STDIN_MARKER)) {
		if (!isStdinPiped()) {
			process.stderr.write(`Missing required argument: ${stdinField}.\n`);
			process.exit(2);
		}

		input[stdinField] = await readStdin();
	}

	const parsed = safeParse(definition.schema, input);

	if (!parsed.success) {
		process.stderr.write(`${parsed.error.message}\n`);
		process.exit(2);
	}

	// Commands that never dial the bridge have no `port`; their context is never connected.
	const { port } = parsed.data;
	const context = createContext(typeof port === 'number' ? port : Number.NaN);

	try {
		const output = await definition.handler(parsed.data, context);

		if (json) {
			process.stdout.write(`${JSON.stringify(output.data ?? output)}\n`);
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

export default toCleyeCommand;
