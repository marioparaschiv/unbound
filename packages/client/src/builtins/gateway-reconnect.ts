import { createLogger } from '@unbound-app/logger';

import { getStore, onAction, type FluxStore } from '~/flux/api';
import { findByProps } from '~/metro/lookups';

type GatewaySocket = {
	connectionState?: string;
	isClosed?(): boolean;
	connect?(): void;
};

type GatewayConnectionStoreShape = FluxStore & { getSocket?(): GatewaySocket | undefined };

type AuthenticationStoreShape = FluxStore & { isAuthenticated?(): boolean };

const Logger = createLogger('GatewayReconnect');
const GatewayCapabilities = findByProps('getIsPaused', 'setIsPaused');

let unsubscribe: (() => void) | null = null;

/**
 * @description Reconnects Discord's gateway when Discord comes to the front with its socket closed. On iOS Discord
 * closes the socket in the background and reopens it only on a background-to-active change, so a return through
 * `inactive` left it closed: no new messages until a restart.
 */
export function start() {
	unsubscribe = onAction('APP_STATE_UPDATE', ({ state }) => {
		if (state === 'active') {
			reconnectIfClosed();
		}
	});
}

/**
 *
 */
export function stop() {
	unsubscribe?.();
	unsubscribe = null;
}

// Runs after Discord's own handler, so a socket Discord is already reopening reads as not closed.
function reconnectIfClosed() {
	const gateway: GatewayConnectionStoreShape = getStore('GatewayConnection');
	const authentication: AuthenticationStoreShape = getStore('Authentication');
	const socket = gateway.getSocket?.();

	if (!socket?.isClosed?.() || !authentication.isAuthenticated?.()) return;

	Logger.info('Reconnecting the gateway, which stayed closed after Discord became active.');
	// A paused gateway skips the connect; Discord unpauses it the same way before reconnecting.
	GatewayCapabilities?.setIsPaused?.(false);
	socket.connect?.();
}

export default { start, stop };
