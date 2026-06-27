import { mkdirSync, readFileSync, watch } from 'node:fs';
import Logger from '@unbound-app/logger';
import { join } from 'node:path';

import { DIST_DIR, BUNDLE_NAME, WATCH_DEBOUNCE } from './constants';

const logger = Logger.create('Serve');

const encoder = new TextEncoder();

const hotClients = new Set<ReadableStreamDefaultController<Uint8Array>>();

let etag = bundleEtag();

/**
 * @description Hashes the built bundle into an etag, so an identical rebuild doesn't reload clients.
 * @returns The bundle's content hash, or '' if it has not been built yet.
 */
export function bundleEtag(): string {
	try {
		return Bun.hash(readFileSync(join(DIST_DIR, BUNDLE_NAME))).toString(16);
	} catch {
		return '';
	}
}

/**
 * @description Serialises a named SSE event with a JSON payload into wire framing.
 * @param event The SSE event name (e.g. `reload`).
 * @param data The payload object, serialised as the `data:` line.
 * @returns The encoded frame ready to enqueue.
 */
function frame(event: string, data: unknown): Uint8Array {
	return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * @description Enqueues a frame to a client, dropping it from the registry if the stream is closed.
 * @param controller The client's stream controller.
 * @param payload The encoded frame to enqueue.
 */
function send(controller: ReadableStreamDefaultController<Uint8Array>, payload: Uint8Array) {
	try {
		controller.enqueue(payload);
	} catch {
		hotClients.delete(controller);
	}
}

/** @description Broadcasts the current bundle etag to every connected hot-reload client. */
function broadcast() {
	const payload = frame('reload', { etag });

	for (const controller of hotClients) send(controller, payload);
}

/**
 * @description Handles an SSE connection on `/__hot`: registers the client's stream, sends it the
 * current etag so it catches up on any build it missed, and deregisters it when the request aborts.
 * @param req The inbound request.
 * @returns A streaming `text/event-stream` response.
 */
export function handleHot(req: Request): Response {
	let controller: ReadableStreamDefaultController<Uint8Array>;

	const stream = new ReadableStream<Uint8Array>({
		start(c) {
			controller = c;
			hotClients.add(controller);
			logger.info(`Hot-reload client connected (${hotClients.size} total).`);

			send(controller, frame('reload', { etag }));
		},
		cancel() {
			hotClients.delete(controller);
			logger.info(`Hot-reload client disconnected (${hotClients.size} total).`);
		},
	});

	req.signal.addEventListener('abort', () => {
		hotClients.delete(controller);
		logger.info(`Hot-reload client disconnected (${hotClients.size} total).`);
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'Access-Control-Allow-Origin': '*',
		},
	});
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

export default { bundleEtag, handleHot, watchBundle };
