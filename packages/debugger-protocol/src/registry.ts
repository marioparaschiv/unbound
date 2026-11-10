import type { StaticDecode, TObject } from 'typebox';

import type { ControllerClient } from './controller';

/**
 * One command definition feeds both surfaces: the CLI builds flags and positionals from its schema,
 * and the MCP server uses the schema as the tool's input schema.
 */

/** The shared runtime a command handler runs against: the bridge controller it evaluates through. */
export type CommandContext = { client: ControllerClient };

/** What a command handler returns: a success flag, human-readable text, and optional structured data. */
export type CommandOutput = { ok: boolean; text: string; data?: unknown };

/** A command usable from both the CLI and (when opted in) the MCP server. */
export type CommandDefinition<S extends TObject = TObject> = {
	/** The word that runs it, under its group when it has one: `eval` in `ubd debug eval`. */
	name: string;
	description: string;
	/** The one line the CLI's menus show for it. */
	summary: string;
	/** Whether `ubd mcp` serves it as a tool. */
	mcp: boolean;
	/** Used directly as the MCP tool's input schema; the CLI adapter derives flags from its properties. */
	schema: S;
	/** Which schema properties the CLI presents as positionals; the rest become flags. */
	cli?: { positionals?: (keyof StaticDecode<S>)[] };
	handler(input: StaticDecode<S>, context: CommandContext): Promise<CommandOutput>;
};
