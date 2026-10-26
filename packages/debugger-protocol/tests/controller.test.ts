import { afterEach, describe, expect, test } from 'bun:test';
import type { Server } from 'bun';

import type { EvalRequest } from '../src/index';

import { ControllerClient } from '../src/controller';

type FakeBridge = { server: Server<undefined>; requests: EvalRequest[] };

const bridges: FakeBridge[] = [];
const clients: ControllerClient[] = [];

afterEach(() => {
	for (const client of clients.splice(0)) client.close();

	for (const bridge of bridges.splice(0)) void bridge.server.stop(true);
});

function fakeBridge(): FakeBridge {
	const requests: EvalRequest[] = [];
	const server = Bun.serve({
		port: 0,
		fetch(request, server) {
			return server.upgrade(request) ? void 0 : new Response(null, { status: 400 });
		},
		websocket: {
			open(socket) {
				socket.send(JSON.stringify({ type: 'device-status', connected: true }));
			},
			message(socket, raw) {
				const request = JSON.parse(String(raw)) as EvalRequest;

				requests.push(request);
				socket.send(
					JSON.stringify({ type: 'eval-result', id: request.id, ok: true, value: '42' }),
				);
			},
		},
	});
	const bridge = { server, requests };

	bridges.push(bridge);

	return bridge;
}

async function connectedClient(bridge: FakeBridge): Promise<ControllerClient> {
	const client = new ControllerClient(`ws://127.0.0.1:${bridge.server.port}`);

	clients.push(client);
	client.connect();

	while (!client.isDeviceConnected) await Bun.sleep(5);

	return client;
}

describe('ControllerClient.evaluate', () => {
	test('sends the requested timeout to the bridge', async () => {
		const bridge = fakeBridge();
		const client = await connectedClient(bridge);
		const result = await client.evaluate('slow()', 60_000);

		expect(result.ok).toBe(true);
		expect(result.value).toBe('42');
		expect(bridge.requests[0]).toMatchObject({ type: 'eval', code: 'slow()', timeout: 60_000 });
	});

	test('leaves the timeout to the bridge when none is given', async () => {
		const bridge = fakeBridge();
		const client = await connectedClient(bridge);

		await client.evaluate('1');

		expect(bridge.requests[0]).not.toHaveProperty('timeout');
	});
});
