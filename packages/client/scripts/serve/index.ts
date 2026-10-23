import Logger from '@unbound-app/logger';

import { PORT, HOST, LAN_URL, DIST_DIR } from './constants';
import { lanCandidates } from '../dev-host';
import { serveStatic } from './static';
import * as refresh from './refresh';
import * as hot from './hot-reload';

const logger = Logger.create('Serve');

/**
 * @description Starts the dev server: the loader's reload stream at `/__hot`, the client's hot-patch
 * socket at `/__refresh`, and the built files in `dist/`.
 * @param reloadOnRebuild Whether the loader reloads the app after every build. Off when the client takes hot patches.
 * @returns The `Bun.Server`, so an orchestrator can stop it.
 */
export function startServer(reloadOnRebuild: boolean = true) {
	const server = Bun.serve({
		port: PORT,
		hostname: HOST,
		// SSE connections are long-lived; never time them out.
		idleTimeout: 0,
		fetch(req, server) {
			const pathname = new URL(req.url).pathname;

			if (pathname === '/__hot') {
				return hot.handleHot(req);
			}

			if (pathname === '/__refresh') {
				return refresh.upgrade(req, server);
			}

			return serveStatic(pathname);
		},
		websocket: refresh.websocket,
	});

	hot.watchBundle(reloadOnRebuild);

	logger.info(`Server listening on http://${HOST}:${PORT}/`);
	logger.info(`Devices on the LAN should connect to: ${LAN_URL}`);
	logger.info(`Serving files from: ${DIST_DIR}`);
	logger.info(`Hot-reload SSE stream at ${LAN_URL}/__hot`);

	const candidates = lanCandidates();

	if (!process.env.DEV_SERVER_URL && !process.env.DEV_HOST && candidates.length > 1) {
		const others = candidates.map((c) => `${c.address} (${c.name})`).join(', ');

		logger.warn(`Multiple network interfaces found: ${others}.`);
		logger.warn(`If the wrong one was chosen, rebuild with --host <ip> or DEV_HOST=<ip>.`);
	}

	return server;
}

export default { startServer };
