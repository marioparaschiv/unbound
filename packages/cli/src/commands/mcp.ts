import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { command, type Command } from 'cleye';

import { createContext } from '~/lib/context';
import { toMcpTool } from '~/adapters/mcp';
import { commands } from '~/registry';

/**
 * @description The `ubd mcp` command: a stdio MCP server exposing every registry entry opted into
 * `surfaces.mcp`, each riding a single long-lived controller connection to the bridge. This is the
 * relocated debugger MCP, now registry-driven.
 */
export const mcpCommand: Command = command(
	{
		name: 'mcp',
		description: 'Serve the debugger as a stdio MCP server for AI clients.',
		flags: {
			port: {
				type: Number,
				description: 'The port the debugger bridge listens on.',
				default: DEFAULT_BRIDGE_PORT,
			},
		},
	},
	async (parsed) => {
		const context = createContext(parsed.flags.port);

		const server = new McpServer({ name: 'ubd', version: '1.0.0' });

		for (const definition of commands) {
			if (!definition.surfaces.mcp) continue;

			toMcpTool(server, definition, context);
		}

		const transport = new StdioServerTransport();
		await server.connect(transport);
	},
);

export default mcpCommand;
