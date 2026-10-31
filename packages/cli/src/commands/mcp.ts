import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { command, cli, type Command } from 'cleye';

import { toCleyeCommand } from '~/adapters/cleye';
import { createContext } from '~/lib/context';
import type { MenuEntry } from '~/lib/menu';
import { toMcpTool } from '~/adapters/mcp';
import { commands } from '~/registry';

/** The agent-facing tools the CLI lists under `ubd mcp` instead of at the root. */
const tools = commands.filter((definition) => definition.surfaces.cli === 'mcp');

/**
 * @description The `ubd mcp` command: a stdio MCP server exposing every registry entry opted into
 * `surfaces.mcp`, each riding a single long-lived controller connection to the bridge.
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
		help: {
			description: 'Serve the debugger as a stdio MCP server for AI clients.',
			usage: ['ubd mcp [flags]', ...tools.map((tool) => `ubd mcp ${tool.name} --help`)],
		},
	},
	(parsed) => {
		const context = createContext(parsed.flags.port);

		const server = new McpServer({ name: 'ubd', version: '1.0.0' });

		for (const definition of commands) {
			if (!definition.surfaces.mcp) {
				continue;
			}

			toMcpTool(server, definition, context);
		}

		const transport = new StdioServerTransport();

		void server.connect(transport);
	},
);

/** How the `ubd` menu lists {@link mcpCommand}, which is not a registry entry. */
export const mcpMenuEntry: MenuEntry = {
	name: 'mcp',
	summary: 'Serve the debugger as an MCP server.',
};

/**
 * @description Whether a name is one of the tools run as `ubd mcp <tool>`.
 * @param name The argument after `mcp`.
 * @returns Whether `ubd mcp <name>` runs a tool instead of the server.
 */
export function isMcpTool(name: string | undefined): boolean {
	return tools.some((tool) => tool.name === name);
}

/**
 * @description Runs one MCP tool from the command line, as `ubd mcp <tool> [args]`.
 * @param argv The arguments after `mcp`, starting with the tool name.
 */
export function runMcpTool(argv: string[]): void {
	cli({ name: 'ubd', commands: tools.map(toCleyeCommand) }, void 0, argv);
}

export default mcpCommand;
