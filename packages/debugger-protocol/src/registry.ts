import type { z } from 'zod';

import type { ControllerClient } from './controller';

/**
 * One command definition feeds both surfaces: the CLI builds flags and positionals from its schema,
 * and the MCP server uses the schema as the tool's input schema.
 */

/** The shared runtime a command handler runs against: the bridge controller it evaluates through. */
export type CommandContext = { client: ControllerClient };

/** What a command handler returns: a success flag, human-readable text, and optional structured data. */
export type CommandOutput = { ok: boolean; text: string; data?: unknown };

/**
 * Every command is on the CLI: at the root (`ubd eval`), or under `ubd mcp` (`ubd mcp open`) for
 * agent-facing tools, which must then be MCP tools too.
 */
export type CommandSurfaces = { cli: 'root'; mcp: boolean } | { cli: 'mcp'; mcp: true };

/** A command usable from both the CLI and (when opted in) the MCP server. */
export type CommandDefinition<S extends z.ZodObject<z.ZodRawShape>> = {
	name: string;
	description: string;
	surfaces: CommandSurfaces;
	/** Used directly as the MCP inputSchema; the CLI adapter derives flags from its fields. */
	schema: S;
	/** Which schema fields the CLI presents as positionals; the rest become flags. */
	cli?: { positionals?: (keyof z.infer<S>)[] };
	handler: (input: z.infer<S>, context: CommandContext) => Promise<CommandOutput>;
};
