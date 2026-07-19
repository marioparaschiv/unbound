import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { command, type Command } from 'cleye';
import { z } from 'zod';

import { createContext, waitForDevice } from '~/lib/context';
import { readStdin, isStdinPiped } from '~/lib/stdin';
import { fieldToFlag } from '~/lib/zod-flags';

/** The value that marks a positional as fed from stdin instead of the command line. */
const STDIN_MARKER = '-';

/**
 * @description Builds a cleye command from a registry definition: the fields named in
 * `cli.positionals` become positional parameters, every other schema field becomes a flag whose type
 * is derived from the zod field. The callback reads a stdin-fed positional when piped, validates the
 * assembled input through the definition's schema, runs the handler, and exits `0`/`1`/`2` on
 * success, on-device failure, and connection or usage error respectively.
 * @param definition The command to adapt.
 * @returns A cleye `command()` ready to register on the CLI.
 */
export function toCleyeCommand(definition: CommandDefinition<z.ZodObject<z.ZodRawShape>>): Command {
	const positionalNames = (definition.cli?.positionals ?? []).map(String);

	const flags: Record<string, ReturnType<typeof fieldToFlag>> = {
		json: {
			type: Boolean,
			description: 'Print the raw result as JSON instead of the formatted transcript.',
			default: false,
		},
	};

	for (const [name, field] of Object.entries(definition.schema.shape)) {
		if (positionalNames.includes(name)) continue;

		flags[name] = fieldToFlag(field as z.ZodType);
	}

	return command(
		{
			name: definition.name,
			description: definition.description,
			parameters: positionalNames.map((name) => `[${name}]`),
			flags,
		},
		async (parsed) => {
			const { json, ...flagInput } = parsed.flags;
			const input: Record<string, unknown> = { ...flagInput };

			for (const name of positionalNames) {
				input[name] = parsed._[name as keyof typeof parsed._];
			}

			await run(definition, input, positionalNames[0], Boolean(json));
		},
	);
}

async function run(
	definition: CommandDefinition<z.ZodObject<z.ZodRawShape>>,
	input: Record<string, unknown>,
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

	const parsed = definition.schema.safeParse(input);

	if (!parsed.success) {
		process.stderr.write(`${z.prettifyError(parsed.error)}\n`);
		process.exit(2);
	}

	const port = (parsed.data as { port?: number }).port;
	const context = createContext(port ?? Number.NaN);

	try {
		await waitForDevice(context.client);

		const output = await definition.handler(parsed.data, context);

		if (json) {
			process.stdout.write(`${JSON.stringify(output.data ?? output)}\n`);
		} else if (output.ok) {
			process.stdout.write(`${output.text}\n`);
		} else {
			process.stderr.write(`${output.text}\n`);
		}

		if (output.ok) process.exit(0);

		process.exit(context.client.isDeviceConnected ? 1 : 2);
	} finally {
		context.client.close();
	}
}

export default toCleyeCommand;
