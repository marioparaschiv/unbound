import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CommandContext } from '@unbound-app/debugger-protocol/registry';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

import { commandError, inputFailure } from '~/lib/command-error';
import type { McpTool } from '~/registry';
import { safeParse } from '~/lib/schema';

/**
 * @description Registers commands as MCP tools on the server: each definition's schema
 * is the tool's input schema, and its handler output maps to a tool result — the formatted text as
 * the sole content block, `ok: false` surfacing as `isError` with the error as structured content. The schemas are JSON Schema already, so
 * the low-level server takes them without a translation layer.
 * @param server The MCP server to register the tools on.
 * @param tools The commands to expose, under their tool names.
 * @param context The runtime the handlers evaluate against.
 */
export function registerTools(server: Server, tools: McpTool[], context: CommandContext): void {
	const byName = new Map(tools.map((tool) => [tool.name, tool.definition]));

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: tools.map(({ name, definition }) => ({
			name,
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

		const output = parsed.success
			? await definition.handler(parsed.data, context)
			: inputFailure(parsed.error);
		const content = [{ type: 'text' as const, text: output.text }];

		if (output.ok) {
			return { isError: false, content };
		}

		return { isError: true, content, structuredContent: { error: commandError(output) } };
	});
}

export default registerTools;
