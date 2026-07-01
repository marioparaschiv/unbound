#!/usr/bin/env bun
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { EvalResult, LogMessage } from './lib/protocol';

import { ControllerClient } from './lib/controller-client';
import argv from './lib/cli';

// Attach to the running bridge as a controller. The bridge owns the device socket; we ride it via
// `?mcp` and never touch the device directly — so the iOS outbound-only firewall is a non-issue.
const url = `ws://127.0.0.1:${argv.flags.port}?mcp`;
const client = new ControllerClient(url);
client.connect();

const server = new McpServer({
	name: 'ub-debugger',
	version: '1.0.0',
});

server.registerTool(
	'eval',
	{
		title: 'Evaluate on device',
		description:
			'Evaluate JavaScript inside the running Unbound client on the connected device and return ' +
			'its result plus any console output the code produced. Use this to inspect the live runtime: ' +
			'read globals (e.g. `unbound.metro`), call APIs, and probe Discord internals. The last ' +
			'expression is the return value; `console.log`/`warn`/`error` are captured separately.',
		inputSchema: {
			code: z.string().describe('The JavaScript to evaluate on the device.'),
		},
	},
	async ({ code }) => {
		if (!client.isDeviceConnected) {
			return {
				isError: true,
				content: [
					{
						type: 'text',
						text: 'No device is connected to the debugger. Launch the app so its debugger dials the bridge, then retry.',
					},
				],
			};
		}

		const result = await client.evaluate(code);

		return {
			isError: !result.ok,
			content: [{ type: 'text', text: format(result) }],
		};
	},
);

function format(result: EvalResult): string {
	const parts: string[] = [];

	if (result.logs?.length) {
		parts.push('--- console ---', result.logs.map(formatLog).join('\n'));
	}

	if (result.ok) {
		parts.push('--- result ---', result.value ?? 'undefined');
	} else {
		parts.push('--- error ---', result.error ?? 'Unknown error.');
	}

	return parts.join('\n');
}

function formatLog(log: LogMessage): string {
	const label = log.level === 3 ? 'error' : log.level === 2 ? 'warn' : 'log';
	return `[${label}] ${log.message}`;
}

const transport = new StdioServerTransport();
await server.connect(transport);
