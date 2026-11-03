import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CommandContext, CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

import { safeParse, type TObject } from '~/lib/schema';

/**
 * @description Registers registry definitions as MCP tools on the server: each definition's schema
 * is the tool's input schema, and its handler output maps to a tool result — the formatted text as
 * the sole content block, `ok: false` surfacing as `isError`. The schemas are JSON Schema already, so
 * the low-level server takes them without a translation layer.
 * @param server The MCP server to register the tools on.
 * @param definitions The commands to expose.
 * @param context The runtime the handlers evaluate against.
 */
export function registerTools(
	server: Server,
	definitions: CommandDefinition<TObject>[],
	context: CommandContext,
): void {
	const byName = new Map(definitions.map((definition) => [definition.name, definition]));

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: definitions.map((definition) => ({
			name: definition.name,
			description: definition.description,
			inputSchema: definition.schema,
		})),
	}));

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const definition = byName.get(request.params.name);

		if (!definition) {
			throw new Error(`Unknown tool: ${request.params.name}`);
		}

		const parsed = safeParse(definition.schema, request.params.arguments ?? {});

		if (!parsed.success) {
			return {
				isError: true,
				content: [{ type: 'text' as const, text: parsed.error.message }],
			};
		}

		const output = await definition.handler(parsed.data, context);

		return {
			isError: !output.ok,
			content: [{ type: 'text' as const, text: output.text }],
		};
	});
}

export default registerTools;
