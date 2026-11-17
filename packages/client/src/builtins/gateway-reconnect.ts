import { createLogger } from '@unbound-app/logger';
import { AppState } from 'react-native';

import { getStore, interceptAction, onAction, type FluxStore } from '~/flux/api';
import { findByProps } from '~/metro/lookups';

type GatewaySocket = {
	connectionState?: string;
	connectionStartTime?: number;
	isClosed?(): boolean;
	connect?(): void;
	resetBackoff?(reason?: string): void;
};

type GatewayConnectionStoreShape = FluxStore & { getSocket?(): GatewaySocket | undefined };

type AuthenticationStoreShape = FluxStore & { isAuthenticated?(): boolean };

const Logger = createLogger('GatewayReconnect');
const GatewayCapabilities = findByProps('getIsPaused', 'setIsPaused');

let unsubscribe: (() => void) | null = null;
let removeInterceptor: (() => void) | null = null;
let backgrounded = false;
// When Discord last left the background, stamped before its own handler runs so its fresh attempt reads as newer.
let resumedAt: number | undefined;

/**
 * @description Reconnects Discord's gateway the moment Discord comes to the front with it stuck on "Connecting". On iOS
 * Discord reopens a closed socket only on a background-to-active change, and keeps an attempt made in the background
 * (a prewarmed launch, or a retry before suspension) until its 30 s hello timeout.
 */
export function start() {
	backgrounded = AppState.currentState === 'background';
	removeInterceptor = interceptAction('APP_STATE_UPDATE', ({ state }) => {
		if (backgrounded && state !== 'background') {
			resumedAt = Date.now();
		}

		backgrounded = state === 'background';
	});
	unsubscribe = onAction('APP_STATE_UPDATE', ({ state }) => {
		if (state === 'active') {
			reconnectIfStuck();
		}
	});
}

/**
 * @description Stops reconnecting the gateway.
 */
export function stop() {
	unsubscribe?.();
	unsubscribe = null;
	removeInterceptor?.();
	removeInterceptor = null;
	resumedAt = undefined;
}

// Runs after Discord's own handler, so a socket Discord is already reopening reads as neither closed nor stale.
function reconnectIfStuck() {
	const gateway: GatewayConnectionStoreShape = getStore('GatewayConnection');
	const authentication: AuthenticationStoreShape = getStore('Authentication');
	const socket = gateway.getSocket?.();
	const since = resumedAt;

	resumedAt = undefined;

	if (!socket || !authentication.isAuthenticated?.()) return;

	// A paused gateway skips the connect; Discord unpauses it the same way before reconnecting.
	if (socket.isClosed?.()) {
		Logger.info('Reconnecting the gateway, which stayed closed after Discord became active.');
		GatewayCapabilities?.setIsPaused?.(false);
		socket.connect?.();

		return;
	}

	if (!isStale(socket, since)) return;

	Logger.info(`Restarting the gateway, stuck in ${socket.connectionState} since the background.`);
	GatewayCapabilities?.setIsPaused?.(false);
	// Discord's Android resume path: drops the attempt and connects at once, skipping the backoff.
	socket.resetBackoff?.('App state is active');
}

// An attempt begun before Discord left the background rode out the suspension and may never answer.
function isStale(socket: GatewaySocket, since: number | undefined) {
	if (since === undefined || socket.connectionState === 'SESSION_ESTABLISHED') {
		return false;
	}

	return (socket.connectionStartTime ?? 0) < since;
}

export default { start, stop };
