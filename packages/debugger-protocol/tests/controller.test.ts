import { afterEach, describe, expect, test } from 'bun:test';
import type { Server, ServerWebSocket } from 'bun';

import { ControllerClient } from '~/controller';
import type { EvalRequest } from '~/index';

type FakeBridge = {
	server: Server<undefined>;
	requests: EvalRequest[];
	sockets: Set<ServerWebSocket<undefined>>;
};

const bridges: FakeBridge[] = [];
const clients: ControllerClient[] = [];

afterEach(() => {
	for (const client of clients.splice(0)) client.close();

	for (const bridge of bridges.splice(0)) void bridge.server.stop(true);
});

function fakeBridge(port = 0): FakeBridge {
	const requests: EvalRequest[] = [];
	const sockets = new Set<ServerWebSocket<undefined>>();
	const server = Bun.serve({
		port,
		fetch(request, server) {
			return server.upgrade(request) ? void 0 : new Response(null, { status: 400 });
		},
		websocket: {
			open(socket) {
				sockets.add(socket);
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
	const bridge = { server, requests, sockets };

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

describe('ControllerClient.connect', () => {
	test('dials only once beforeConnect has started the bridge', async () => {
		const reserved = fakeBridge();
		const port = Number(reserved.server.port);

		await reserved.server.stop(true);

		const client = new ControllerClient(`ws://127.0.0.1:${port}`, {
			beforeConnect: async () => void fakeBridge(port),
		});

		clients.push(client);
		client.connect();
		// Well under the 1s reconnect delay, so only a first dial that waited for the hook connects.
		await Bun.sleep(300);

		expect(client.isDeviceConnected).toBe(true);
	});
});

describe('ControllerClient hooks', () => {
	test('reports the device status, logs and a dropped bridge', async () => {
		const bridge = fakeBridge();
		const statuses: boolean[] = [];
		const connections: boolean[] = [];
		const logs: string[] = [];
		const client = new ControllerClient(`ws://127.0.0.1:${bridge.server.port}`, {
			onDeviceStatus: (connected) => statuses.push(connected),
			onConnection: (open) => connections.push(open),
			onLog: (log) => logs.push(log.message),
		});

		clients.push(client);
		client.connect();

		while (!client.isDeviceConnected) await Bun.sleep(5);

		for (const socket of bridge.sockets) {
			socket.send(JSON.stringify({ type: 'log', level: 1, message: 'hi' }));
		}

		while (!logs.length) await Bun.sleep(5);

		await bridge.server.stop(true);

		while (connections.length < 2) await Bun.sleep(5);

		expect(statuses).toEqual([true]);
		expect(logs).toEqual(['hi']);
		expect(connections).toEqual([true, false]);
	});

	test('does not report a dial that never opened as a drop', async () => {
		const connections: boolean[] = [];
		const client = new ControllerClient('ws://127.0.0.1:9', {
			onConnection: (open) => connections.push(open),
		});

		clients.push(client);
		client.connect();
		await Bun.sleep(100);

		expect(connections).toEqual([]);
	});
});

describe('ControllerClient.evaluate', () => {
	test('sends the requested timeout to the bridge', async () => {
		const bridge = fakeBridge();
		const client = await connectedClient(bridge);
		const result = await client.evaluate('slow()', 60_000);

		expect(result).toMatchObject({ ok: true, value: '42' });
		expect(bridge.requests[0]).toMatchObject({ type: 'eval', code: 'slow()', timeout: 60_000 });
	});

	test('leaves the timeout to the bridge when none is given', async () => {
		const bridge = fakeBridge();
		const client = await connectedClient(bridge);

		await client.evaluate('1');

		expect(bridge.requests[0]).not.toHaveProperty('timeout');
	});

	test('fails with a code when it has no bridge, and when it shuts down mid-eval', async () => {
		const unconnected = new ControllerClient('ws://127.0.0.1:9');

		expect(await unconnected.evaluate('1')).toMatchObject({
			ok: false,
			code: 'bridge-unreachable',
		});

		const bridge = fakeBridge();
		const client = await connectedClient(bridge);

		bridge.server.stop(true);

		const pending = client.evaluate('never()');

		client.close();

		expect(await pending).toMatchObject({ ok: false, code: expect.any(String) });
	});
});
