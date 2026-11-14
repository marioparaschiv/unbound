import { findByProps } from '~/metro/lookups';

import type { DebugInfo } from './format-debug-info';

/** The fields of Discord's gateway socket the report reads; each may vanish in a Discord update. */
export type GatewaySocket = {
	connectionState_?: unknown;
	lastHeartbeatTime?: unknown;
	lastHeartbeatAckTime?: unknown;
	identifyCount?: unknown;
	failedConnectAttempts?: unknown;
};

const GatewayConnectionStore = findByProps('getSocket', 'isConnected', 'lastTimeConnectedChanged');

function isCount(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function heartbeatLatency(socket: GatewaySocket): number | undefined {
	const sent = socket.lastHeartbeatTime;
	const acked = socket.lastHeartbeatAckTime;

	if (typeof sent !== 'number' || typeof acked !== 'number' || !sent || acked < sent) {
		return undefined;
	}

	return acked - sent;
}

/**
 * @description Reduces Discord's gateway socket to its health: the connection state, heartbeat latency, how long it has
 * been connected, and how often it identified or failed to connect.
 * @param socket The gateway socket.
 * @param connected Whether the store calls the gateway connected.
 * @param changedAt When the connection last opened or closed.
 * @param now The current time.
 * @returns The report, or `undefined` when the socket has no readable state.
 */
export function gatewayHealth(
	socket: GatewaySocket,
	connected: boolean,
	changedAt: number,
	now = Date.now(),
): DebugInfo['gateway'] {
	const state = socket.connectionState_;

	if (typeof state !== 'string') {
		return undefined;
	}

	return {
		state: state.toLowerCase().replaceAll('_', ' ').slice(0, 32),
		latencyMs: heartbeatLatency(socket),
		connectedS:
			connected && changedAt ? Math.max(0, Math.round((now - changedAt) / 1000)) : undefined,
		identifies: isCount(socket.identifyCount) ? socket.identifyCount : undefined,
		failedAttempts: isCount(socket.failedConnectAttempts)
			? socket.failedConnectAttempts
			: undefined,
	};
}

/**
 * @description Reads the health of Discord's gateway connection for `/debug`.
 * @returns The report, or `undefined` when the store or socket cannot be read.
 */
export function readGateway(): DebugInfo['gateway'] {
	const socket: GatewaySocket | undefined = GatewayConnectionStore?.getSocket?.();

	if (!socket) {
		return undefined;
	}

	return gatewayHealth(
		socket,
		Boolean(GatewayConnectionStore?.isConnected?.()),
		Number(GatewayConnectionStore?.lastTimeConnectedChanged?.() ?? 0),
	);
}

export default readGateway;
