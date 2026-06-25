import { createLogger } from '@unbound-app/logger';

import { DEV, DEV_SERVER_URL } from '~/lib/constants';
import { reload } from '~/api/native';

const logger = createLogger('DevReload');

const RECONNECT_DELAY = 1000;

let controller: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

/**
 * @description Opens the dev server's `/__hot` SSE stream and reloads the bundle on every `reload`
 * event, reconnecting if the stream drops. Each frame is a blank-line-delimited block whose
 * `event:` line names the event.
 */
async function connect() {
	if (stopped) return;

	controller = new AbortController();

	try {
		const res = await fetch(`${DEV_SERVER_URL}/__hot`, { signal: controller.signal });
		if (!res.ok || !res.body) throw new Error(`Hot-reload stream returned ${res.status}.`);

		logger.success('Connected to hot-reload stream.');

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			let boundary = buffer.indexOf('\n\n');

			while (~boundary) {
				const frame = buffer.slice(0, boundary);
				buffer = buffer.slice(boundary + 2);

				if (frame.includes('event: reload')) {
					logger.info('Bundle rebuilt - reloading.');
					return void reload();
				}

				boundary = buffer.indexOf('\n\n');
			}
		}
	} catch (error: any) {
		if (stopped || error?.name === 'AbortError') return;
		logger.warn('Hot-reload stream dropped; reconnecting.', error?.message);
	}

	if (stopped) return;
	reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
}

export function start() {
	stopped = false;
	void connect();
}

export function stop() {
	stopped = true;

	if (reconnectTimer) clearTimeout(reconnectTimer);
	reconnectTimer = null;

	controller?.abort();
	controller = null;
}

export function shouldStart() {
	return DEV;
}

export default { start, stop, shouldStart };
