import Logger from '@unbound-app/logger';
import { format } from 'date-fns';
import { join } from 'node:path';
import { watch } from 'node:fs';
import { file } from 'bun';

import { lanCandidates, resolveDevServerUrl } from '../dev-host';

const logger = Logger.create('Serve');
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = join(__dirname, '..', '..', 'dist');

// The address a device on the LAN should point at - matches what the dev build
// bakes into the bundle, so the two never drift.
const LAN_URL = resolveDevServerUrl();

/** Connected hot-reload clients, each a controller pushing SSE frames to one device. */
const hotClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encoder = new TextEncoder();

/** Broadcasts a named SSE event to every connected hot-reload client. */
function broadcast(event: string) {
	const frame = encoder.encode(`event: ${event}\ndata: {}\n\n`);

	for (const client of hotClients) {
		try {
			client.enqueue(frame);
		} catch {
			hotClients.delete(client);
		}
	}
}

// Debounced because the bundle write can fire `watch` more than once per build.
let watchTimer: ReturnType<typeof setTimeout> | null = null;

watch(DIST_DIR, (_event, filename) => {
	if (filename !== 'unbound.bundle') return;
	if (watchTimer) clearTimeout(watchTimer);

	watchTimer = setTimeout(() => {
		if (hotClients.size === 0) return;

		logger.info(`Bundle changed - reloading ${hotClients.size} client(s).`);
		broadcast('reload');
	}, 100);
});

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

const server = Bun.serve({
	port: PORT,
	hostname: HOST,
	async fetch(req) {
		const startTime = performance.now();
		const url = new URL(req.url);
		const pathname = url.pathname;

		if (pathname === '/__hot') {
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					hotClients.add(controller);
					controller.enqueue(encoder.encode(': connected\n\n'));
					logger.info(`Hot-reload client connected (${hotClients.size} total).`);

					// Keepalive: an idle SSE stream gets dropped by the device/OS. A periodic comment
					// frame keeps the connection warm without triggering a reload.
					const keepalive = setInterval(() => {
						try {
							controller.enqueue(encoder.encode(': keepalive\n\n'));
						} catch {
							clearInterval(keepalive);
							hotClients.delete(controller);
						}
					}, 15000);

					req.signal.addEventListener('abort', () => {
						clearInterval(keepalive);
						hotClients.delete(controller);
						logger.info(`Hot-reload client disconnected (${hotClients.size} total).`);
					});
				},
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

		try {
			const filePath = join(DIST_DIR, pathname.slice(1));

			if (!filePath.startsWith(DIST_DIR)) {
				logger.error(`GET ${pathname} - Path traversal attempt blocked`);
				return new Response('Forbidden', { status: 403 });
			}

			const f = file(filePath);
			const exists = await f.exists();

			if (!exists) {
				logger.warn(`GET ${pathname} - File not found`);
				return new Response('Not Found', { status: 404 });
			}

			const duration = (performance.now() - startTime).toFixed(2);

			logger.success(
				`(${format(Date.now(), 'HH:mm:ss')}) GET ${pathname} - ${formatBytes(f.size)} in ${duration}ms`,
			);

			return new Response(f, {
				headers: {
					'Content-Type': f.type,
					'Access-Control-Allow-Origin': '*',
				},
			});
		} catch (error: any) {
			const duration = (performance.now() - startTime).toFixed(2);
			logger.error(`GET ${pathname} - Error after ${duration}ms:`, error.message);
			return new Response('Internal Server Error', { status: 500 });
		}
	},
});

logger.info(`Server listening on http://${HOST}:${PORT}/`);
logger.info(`Devices on the LAN should connect to: ${LAN_URL}`);
logger.info(`Serving files from: ${DIST_DIR}`);
logger.info(`Hot-reload stream at ${LAN_URL}/__hot`);

// When several interfaces look LAN-like (common with WSL/Hyper-V/VPNs) the
// auto-detected address may be wrong; tell the user how to pin it.
const candidates = lanCandidates();
if (!process.env.DEV_SERVER_URL && !process.env.DEV_HOST && candidates.length > 1) {
	const others = candidates.map((c) => `${c.address} (${c.name})`).join(', ');
	logger.warn(`Multiple network interfaces found: ${others}.`);
	logger.warn(`If the wrong one was chosen, rebuild with --host <ip> or DEV_HOST=<ip>.`);
}

logger.log('Press Ctrl+C to stop');

process.on('SIGINT', () => {
	logger.newLine();
	logger.log('Shutting down server...');
	server.stop();
	logger.success('Server stopped');
	process.exit(0);
});
