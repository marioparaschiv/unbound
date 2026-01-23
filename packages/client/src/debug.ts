import { findByProps } from '~/api/metro';

const CONFIG = {
	enabled: true,
	address: '192.168.0.95:9090',
	depth: 2,
};

enum Levels {
	error = 3,
	// oxlint-disable-next-line typescript/no-duplicate-enum-values
	info = 1,
	log = 1,
	warn = 2,
	// oxlint-disable-next-line typescript/no-duplicate-enum-values
	trace = 0,
	debug = 0,
}

let ws: WebSocket | null = null;
let Util: any;

export function start() {
	if (!CONFIG.enabled) return;

	Util = findByProps('inspect');

	ws = new WebSocket(`ws://${CONFIG.address}`);

	ws.addEventListener('open', () => {
		nativeLoggingHook('[Debug Bridge] Connected.', Levels.log);
	});

	ws.addEventListener('close', ({ code }) => {
		nativeLoggingHook(`[Debug Bridge] Socket closed with code ${code}.`, Levels.warn);
		ws = null;
	});

	ws.addEventListener('message', (message) => {
		try {
			// oxlint-disable-next-line no-eval
			const result = eval(message.data);
			console.log(result);
		} catch (e) {
			console.error(e);
		}
	});

	patchConsole();
}

export function stop() {
	if (ws?.readyState === WebSocket.OPEN) {
		ws.close();
		ws = null;
	}

	unpatchConsole();
}

function patchConsole() {
	for (const method of ['error', 'info', 'log', 'warn', 'trace', 'debug']) {
		console[method].__ORIGINAL__ = console[method];

		console[method] = (...args) => {
			const payload: string[] = [];

			for (let i = 0, len = args.length; len > i; i++) {
				const item = args[i];
				const out =
					typeof item === 'string'
						? item
						: Util?.inspect?.(item, { showHidden: true, depth: CONFIG.depth }) ||
							String(item);

				payload.push(out ?? item.toString());
			}

			const output = payload.join(' ');

			if (ws?.readyState === WebSocket.OPEN) {
				try {
					ws.send(
						JSON.stringify({ level: Levels[method] ?? Levels.info, message: output }),
					);
				} catch (error) {
					nativeLoggingHook('[Debug Bridge] Failed to send log message:', Levels.error);
				}
			}

			nativeLoggingHook(output, Levels[method] ?? Levels.info);
		};
	}
}

function unpatchConsole() {
	for (const method of ['error', 'info', 'log', 'warn', 'trace', 'debug']) {
		const orig = console[method].__ORIGINAL__;
		if (!orig) continue;

		console[method] = orig;
	}
}
