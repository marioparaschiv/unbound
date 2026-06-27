import Logger from '@unbound-app/logger';

import { PORT, HOST, LAN_URL, DIST_DIR, WS_IDLE_TIMEOUT } from './constants';
import { lanCandidates } from '../dev-host';
import { serveStatic } from './static';
import * as hot from './hot-reload';

const logger = Logger.create('Serve');

/**
 * Starts the dev `serve` server: hosts the hot-reload WebSocket at `/__hot`, serves the built
 * bundle and locale tables from `dist/`, and watches the bundle to broadcast reloads. Returns the
 * `Bun.Server` so an orchestrator can stop it.
 */
export function startServer() {
	const server = Bun.serve({
		port: PORT,
		hostname: HOST,
		idleTimeout: WS_IDLE_TIMEOUT,
		fetch(req) {
			const pathname = new URL(req.url).pathname;

			if (pathname === '/__hot') {
				if (server.upgrade(req)) return;

				return new Response('Upgrade failed', { status: 426 });
			}

			return serveStatic(pathname);
		},
		websocket: {
			idleTimeout: WS_IDLE_TIMEOUT,
			open: hot.open,
			close: hot.close,
			message: hot.message,
		},
	});

	hot.startKeepAlive();
	hot.watchBundle();

	logger.info(`Server listening on http://${HOST}:${PORT}/`);
	logger.info(`Devices on the LAN should connect to: ${LAN_URL}`);
	logger.info(`Serving files from: ${DIST_DIR}`);
	logger.info(`Hot-reload socket at ${LAN_URL}/__hot`);

	const candidates = lanCandidates();

	if (!process.env.DEV_SERVER_URL && !process.env.DEV_HOST && candidates.length > 1) {
		const others = candidates.map((c) => `${c.address} (${c.name})`).join(', ');
		logger.warn(`Multiple network interfaces found: ${others}.`);
		logger.warn(`If the wrong one was chosen, rebuild with --host <ip> or DEV_HOST=<ip>.`);
	}

	return server;
}

export default { startServer };
