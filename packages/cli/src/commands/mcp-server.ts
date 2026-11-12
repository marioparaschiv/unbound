import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

import { registerTools } from '~/adapters/mcp';
import { createContext } from '~/lib/context';
import { mcpTools } from '~/registry';

/**
 * @description Serves every command opted into `mcp` as a stdio MCP tool, each riding one long-lived
 * controller connection to the bridge. Loaded only by `ubd mcp`, so other commands skip the MCP SDK.
 * @param port The port the debugger bridge listens on.
 */
export function serveMcp(port: number): void {
	const context = createContext(port);
	const server = new Server({ name: 'ubd', version: '1.0.0' }, { capabilities: { tools: {} } });

	registerTools(server, mcpTools(), context);

	void server.connect(new StdioServerTransport());
}

export default serveMcp;
