import type { Server, ServerWebSocket, WebSocketHandler } from 'bun';
import Logger from '@unbound-app/logger';

import type { DeviceMessage } from '../../src/hot-refresh/messages';
import type { HotUpdate } from '../build';

import * as outcome from './outcome';

/** The parts of rolldown's dev engine that track which patches each client has run. */
export type ClientTracker = {
	registerClient(clientId: string): Promise<void>;
	removeClient(clientId: string): Promise<void>;
	notifyPayloadDelivered(filename: string): Promise<void>;
};

type SocketData = { clientId: string };

const logger = Logger.create('Serve', 'Refresh');

function isDeviceMessage(value: unknown): value is DeviceMessage {
	if (typeof value !== 'object' || value === null || !('type' in value)) {
		return false;
	}

	if (value.type === 'rejected') {
		return !('reason' in value) || typeof value.reason === 'string';
	}

	if (value.type === 'refreshed') {
		return (
			'fibers' in value &&
			typeof value.fibers === 'number' &&
			'remounted' in value &&
			typeof value.remounted === 'number' &&
			'ms' in value &&
			typeof value.ms === 'number'
		);
	}

	return value.type === 'applied' && 'filename' in value && typeof value.filename === 'string';
}

/**
 * @description Parses a device's message.
 * @param raw The message as received off the socket.
 * @returns The message, or `undefined` when it is not valid JSON or not a known message.
 */
function parseDeviceMessage(raw: string | Buffer): DeviceMessage | undefined {
	try {
		const value: unknown = JSON.parse(String(raw));

		return isDeviceMessage(value) ? value : undefined;
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
 * @description Sends a patch to the device it was built for, and records the build's progress for `/__outcome`.
 * A change no patch covers reloads through the loader's `/__hot` stream once its build is on disk.
 * @param update The dev engine's update.
 * @returns Resolves once the update is sent.
 */
export async function deliver(update: HotUpdate) {
	switch (update.type) {
		case 'change':
			outcome.changed(update.file);

			return;
		case 'failed':
			outcome.failed(update.error);

			return;
		case 'built':
			outcome.built();

			return;
		case 'reload':
			outcome.needsReload(update.reason);

			return;
		case 'patch':
			break;
	}

	const socket = sockets.get(update.clientId);

	if (!socket) return;

	logger.info(`Patching ${update.changedIds.join(', ')}`);
	outcome.sent();
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
		outcome.reconnected();
	},
	/**
	 * @description Records an applied or refreshed patch, or a rejected one the loader must reload for.
	 * @param socket The device's socket.
	 * @param _socket
	 * @param raw The device's message.
	 */
	async message(_socket, raw) {
		const message = parseDeviceMessage(raw);

		if (!message) {
			logger.warn('Ignored a malformed message from a device.');

			return;
		}

		if (message.type === 'applied') {
			await tracker?.notifyPayloadDelivered(message.filename);

			return;
		}

		if (message.type === 'refreshed') {
			outcome.patched(message.fibers, message.remounted, message.ms);

			return;
		}

		outcome.needsReload(message.reason ?? 'the device could not patch in place');
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
