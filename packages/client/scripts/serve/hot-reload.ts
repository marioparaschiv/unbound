import { mkdirSync, readFileSync, watch } from 'node:fs';
import type { ServerWebSocket } from 'bun';
import Logger from '@unbound-app/logger';
import { join } from 'node:path';

import { DIST_DIR, BUNDLE_NAME, WATCH_DEBOUNCE, KEEPALIVE_INTERVAL } from './constants';

const logger = Logger.create('Serve');

const hotClients = new Set<ServerWebSocket>();

let etag = bundleEtag();

/**
 * @description Hashes the built bundle into a non-cryptographic etag. A content hash rather than
 * mtime so a rebuild that produces identical output doesn't reload clients.
 * @returns The bundle's content hash, or '' if it has not been built yet.
 */
function bundleEtag(): string {
	try {
		return Bun.hash(readFileSync(join(DIST_DIR, BUNDLE_NAME))).toString(16);
	} catch {
		return '';
	}
}

/**
 * @description Sends a JSON frame to a client, dropping it from the registry if the send throws.
 * @param ws The client socket.
 * @param frame The serialised frame to send.
 */
function send(ws: ServerWebSocket, frame: string) {
	try {
		ws.send(frame);
	} catch {
		hotClients.delete(ws);
	}
}

/** @description Broadcasts the current bundle etag to every connected hot-reload client. */
function broadcast() {
	const frame = JSON.stringify({ type: 'reload', etag });

	for (const ws of hotClients) send(ws, frame);
}

/**
 * @description Registers a connected client and hands it the current etag so a client that missed a
 * build while disconnected catches up.
 * @param ws The newly connected client socket.
 */
export function open(ws: ServerWebSocket) {
	hotClients.add(ws);
	logger.info(`Hot-reload client connected (${hotClients.size} total).`);

	ws.send(JSON.stringify({ type: 'reload', etag }));
}

/**
 * @description Removes a disconnected client from the registry.
 * @param ws The disconnected client socket.
 */
export function close(ws: ServerWebSocket) {
	hotClients.delete(ws);
	logger.info(`Hot-reload client disconnected (${hotClients.size} total).`);
}

/**
 * @description Handles an inbound client message. RN does not surface WS protocol pings, so the
 * client speaks JSON ping/pong; reply to its ping and ignore its pong.
 * @param ws The client socket the message came from.
 * @param raw The raw message payload.
 */
export function message(ws: ServerWebSocket, raw: string | Buffer) {
	let payload: { type?: string } | null = null;

	try {
		payload = JSON.parse(String(raw));
	} catch {
		payload = null;
	}

	if (payload?.type === 'ping') {
		ws.send(JSON.stringify({ type: 'pong' }));
	}
}

/**
 * @description Starts the app-level keepalive. RN silently drops sockets that look idle, so a JSON
 * ping is sent on an interval to keep the connection warm.
 * @returns The interval handle.
 */
export function startKeepAlive(): ReturnType<typeof setInterval> {
	const frame = JSON.stringify({ type: 'ping' });

	return setInterval(() => {
		for (const ws of hotClients) send(ws, frame);
	}, KEEPALIVE_INTERVAL);
}

/**
 * @description Watches `dist/` for bundle writes and broadcasts a reload when the content hash
 * changes, recomputing it even with no clients connected so a later-connecting client catches up.
 * @returns The `FSWatcher`, so the caller can close it on shutdown.
 */
export function watchBundle() {
	mkdirSync(DIST_DIR, { recursive: true });

	// Debounced because the bundle write can fire `watch` more than once per build.
	let watchTimer: ReturnType<typeof setTimeout> | null = null;

	return watch(DIST_DIR, (_event, filename) => {
		if (filename !== BUNDLE_NAME) return;
		if (watchTimer) clearTimeout(watchTimer);

		watchTimer = setTimeout(() => {
			const next = bundleEtag();
			if (next === etag) return;

			etag = next;

			if (hotClients.size === 0) return;

			logger.info(`Bundle changed - reloading ${hotClients.size} client(s).`);
			broadcast();
		}, WATCH_DEBOUNCE);
	});
}

export default { open, close, message, startKeepAlive, watchBundle };
