import type { CommandDefinition, CommandContext } from '@unbound-app/debugger-protocol/registry';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';

/**
 * @description Registers a registry definition as an MCP tool on the given server: the definition's
 * schema is the tool's input schema, and its handler output maps to a tool result — the formatted
 * text as the sole content block, `ok: false` surfacing as `isError`.
 * @param server The MCP server to register the tool on.
 * @param definition The command to expose.
 * @param context The runtime the handler evaluates against.
 */
export function toMcpTool(
	server: McpServer,
	definition: CommandDefinition<z.ZodObject<z.ZodRawShape>>,
	context: CommandContext,
): void {
	server.registerTool(
		definition.name,
		{
			description: definition.description,
			inputSchema: definition.schema,
		},
		async (input) => {
			const output = await definition.handler(input, context);

			return {
				isError: !output.ok,
				content: [{ type: 'text', text: output.text }],
			};
		},
	);
}

export default toMcpTool;
