import * as api from './api';

declare const window: { unbound: object };

/**
 *
 */
export function initialize(): void {
	window.unbound = { ...api, initialize, shutdown };
}

/**
 *
 */
export function shutdown(): void {
	window.unbound = { initialize, shutdown };
}
