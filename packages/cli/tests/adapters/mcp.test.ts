import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { expect, test } from 'bun:test';

import { registerTools } from '~/adapters/mcp';
import { failure } from '~/lib/command-error';
import { createContext } from '~/lib/context';
import { Type } from '~/lib/schema';

const schema = Type.Object({ id: Type.String() });

const definition: CommandDefinition<typeof schema> = {
	name: 'find',
	description: 'Finds an addon.',
	summary: 'Finds an addon.',
	mcp: true,
	schema,
	async handler({ id }) {
		return id === 'here'
			? { ok: true, text: 'Found.' }
			: failure('not-found', `No addon is named ${id}.`);
	},
};

async function connect(): Promise<Client> {
	const server = new Server({ name: 'test', version: '1.0.0' }, { capabilities: { tools: {} } });
	const client = new Client({ name: 'test', version: '1.0.0' });
	const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();

	// A command that never reads `client` never dials the bridge.
	registerTools(server, [{ name: 'find', definition }], createContext(Number.NaN));
	await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

	return client;
}

test('a failed tool carries its error as structured content', async () => {
	const client = await connect();
	const result = await client.callTool({ name: 'find', arguments: { id: 'gone' } });

	expect(result).toEqual({
		isError: true,
		content: [{ type: 'text', text: 'No addon is named gone.' }],
		structuredContent: { error: { code: 'not-found', message: 'No addon is named gone.' } },
	});
});

test('rejected arguments fail as invalid-input on the field', async () => {
	const client = await connect();
	const result = await client.callTool({ name: 'find', arguments: {} });

	expect(result).toMatchObject({
		isError: true,
		structuredContent: { error: { code: 'invalid-input', field: 'id' } },
	});
});

test('a success has no structured content', async () => {
	const client = await connect();
	const result = await client.callTool({ name: 'find', arguments: { id: 'here' } });

	expect(result).toEqual({ isError: false, content: [{ type: 'text', text: 'Found.' }] });
});
