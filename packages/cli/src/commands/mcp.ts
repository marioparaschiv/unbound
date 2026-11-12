import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { command, type Command } from 'cleye';

import type { MenuEntry } from '~/lib/menu';

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
		void import('./mcp-server').then(({ serveMcp }) => serveMcp(parsed.flags.port));
	},
);

/** How the `ubd` menu lists {@link mcpCommand}, which is not a registry entry. */
export const mcpMenuEntry: MenuEntry = {
	name: 'mcp',
	summary: 'Serve the debug and device commands as MCP tools.',
};

export default mcpCommand;
