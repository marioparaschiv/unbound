import { describe, expect, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

mockLookups({ findStore: () => undefined });

const { gatewayHealth, readGateway } = await import('~/diagnostics/gateway');

const socket = {
	connectionState_: 'SESSION_ESTABLISHED',
	lastHeartbeatTime: 1_000_000,
	lastHeartbeatAckTime: 1_000_130,
	identifyCount: 2,
	failedConnectAttempts: 0,
};

describe('gatewayHealth', () => {
	test('reports the state, latency and how long it has been connected', () => {
		expect(gatewayHealth(socket, true, 400_000, 1_000_000)).toEqual({
			state: 'session established',
			latencyMs: 130,
			connectedS: 600,
			identifies: 2,
			failedAttempts: 0,
		});
	});

	test('leaves out a heartbeat still waiting for its ack and the uptime while disconnected', () => {
		const health = gatewayHealth(
			{ ...socket, connectionState_: 'WILL_RECONNECT', lastHeartbeatAckTime: 999_000 },
			false,
			400_000,
		);

		expect(health).toMatchObject({ state: 'will reconnect' });
		expect(health?.latencyMs).toBeUndefined();
		expect(health?.connectedS).toBeUndefined();
	});

	test('reports nothing when Discord renamed the state field', () => {
		expect(gatewayHealth({}, true, 0)).toBeUndefined();
	});

	test('reads nothing without the store', () => {
		expect(readGateway()).toBeUndefined();
	});
});
