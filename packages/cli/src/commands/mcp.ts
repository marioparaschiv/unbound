import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { command, type Command } from 'cleye';

import { registerTools } from '~/adapters/mcp';
import { createContext } from '~/lib/context';
import type { MenuEntry } from '~/lib/menu';
import { mcpTools } from '~/registry';

const DESCRIPTION =
	'Serve the debug and device commands as stdio MCP tools for AI clients, over one long-lived ' +
	'connection to the debugger bridge. `ubd debug` commands keep their names (`eval`); the others ' +
	'take their group as a prefix (`device_install`).';

/**
 * @description The `ubd mcp` command: a stdio MCP server exposing every command opted into `mcp`,
 * each riding a single long-lived controller connection to the bridge.
 */
export const mcpCommand: Command = command(
	{
		name: 'mcp',
		description: 'Serve the debug and device commands as MCP tools.',
		flags: {
			port: {
				type: Number,
				description: 'The port the debugger bridge listens on.',
				default: DEFAULT_BRIDGE_PORT,
			},
		},
		help: { description: DESCRIPTION },
	},
	(parsed) => {
		const context = createContext(parsed.flags.port);

		const server = new Server(
			{ name: 'ubd', version: '1.0.0' },
			{ capabilities: { tools: {} } },
		);

		registerTools(server, mcpTools(), context);

		const transport = new StdioServerTransport();

		void server.connect(transport);
	},
);

/** How the `ubd` menu lists {@link mcpCommand}, which is not a registry entry. */
export const mcpMenuEntry: MenuEntry = {
	name: 'mcp',
	summary: 'Serve the debug and device commands as MCP tools.',
};

export default mcpCommand;
