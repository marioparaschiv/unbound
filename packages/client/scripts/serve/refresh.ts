import type { Server, ServerWebSocket, WebSocketHandler } from 'bun';
import Logger from '@unbound-app/logger';

import type { HotUpdate } from '../build';

/** The parts of rolldown's dev engine that track which patches each client has run. */
export type ClientTracker = {
	registerClient(clientId: string): Promise<void>;
	removeClient(clientId: string): Promise<void>;
	notifyPayloadDelivered(filename: string): Promise<void>;
	ensureLatestBuildOutput(): Promise<void>;
};

type SocketData = { clientId: string };

type ClientMessage = { type: 'applied'; filename: string } | { type: 'rejected' };

const logger = Logger.create('Serve', 'Refresh');

function isClientMessage(value: unknown): value is ClientMessage {
	if (typeof value !== 'object' || value === null || !('type' in value)) {
		return false;
	}

	if (value.type === 'rejected') {
		return true;
	}

	return value.type === 'applied' && 'filename' in value && typeof value.filename === 'string';
}

/**
 * @description Parses a device's message.
 * @param raw The message as received off the socket.
 * @returns The message, or `undefined` when it is not valid JSON or not a known message.
 */
function parseClientMessage(raw: string | Buffer): ClientMessage | undefined {
	try {
		const value: unknown = JSON.parse(String(raw));

		return isClientMessage(value) ? value : undefined;
	} catch {
		return undefined;
	}
}

const sockets = new Map<string, ServerWebSocket<SocketData>>();

let tracker: ClientTracker | null = null;

/**
 * @description Connects the dev engine, so each device socket gets its own patch stream.
 * @param engine The dev engine producing patches.
 */
export function attach(engine: ClientTracker) {
	tracker = engine;
}

/**
 * @description Upgrades a `/__refresh` request to the device's hot-patch socket.
 * @param req The inbound request.
 * @param server The server handling it.
 * @returns A 400 response when the upgrade fails, otherwise nothing.
 */
export function upgrade(req: Request, server: Server<SocketData>): Response | undefined {
	if (server.upgrade(req, { data: { clientId: crypto.randomUUID() } })) return;

	return new Response('Expected a WebSocket upgrade', { status: 400 });
}

/**
 * @description Sends a patch to the device it was built for, or a reload to every device once the rebuild is on disk.
 * @param update The dev engine's update.
 * @returns Resolves once the update is sent.
 */
export async function deliver(update: HotUpdate) {
	if (update.type === 'reload') {
		await tracker?.ensureLatestBuildOutput();

		for (const socket of sockets.values()) socket.send(JSON.stringify(update));

		return;
	}

	const socket = sockets.get(update.clientId);

	if (!socket) return;

	logger.info(`Patching ${update.changedIds.join(', ')}`);
	socket.send(JSON.stringify(update));
}

export const websocket: WebSocketHandler<SocketData> = {
	/**
	 * @description Registers a connected device with the dev engine.
	 * @param socket The device's socket.
	 */
	async open(socket) {
		const { clientId } = socket.data;

		sockets.set(clientId, socket);
		await tracker?.registerClient(clientId);
		logger.info(`Device connected (${sockets.size} total).`);
	},
	/**
	 * @description Records an applied patch, or answers a reload request with the latest build.
	 * @param socket The device's socket.
	 * @param raw The device's message.
	 */
	async message(socket, raw) {
		const message = parseClientMessage(raw);

		if (!message) {
			logger.warn('Ignored a malformed message from a device.');

			return;
		}

		if (message.type === 'applied') {
			await tracker?.notifyPayloadDelivered(message.filename);

			return;
		}

		await tracker?.ensureLatestBuildOutput();
		socket.send(JSON.stringify({ type: 'reload' }));
	},
	/**
	 * @description Forgets a disconnected device.
	 * @param socket The device's socket.
	 */
	async close(socket) {
		const { clientId } = socket.data;

		sockets.delete(clientId);
		await tracker?.removeClient(clientId);
		logger.info(`Device disconnected (${sockets.size} total).`);
	},
};

export default { attach, upgrade, deliver, websocket };
