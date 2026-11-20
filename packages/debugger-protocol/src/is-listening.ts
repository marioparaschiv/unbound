import { connect } from 'node:net';

/**
 * @description Checks whether anything accepts TCP connections on a local port, such as a running bridge.
 * @param port The port to probe on `127.0.0.1`.
 * @returns Whether a connection was accepted.
 */
export function isListening(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ host: '127.0.0.1', port });

		socket.once('connect', () => {
			socket.destroy();
			resolve(true);
		});
		socket.once('error', () => resolve(false));
	});
}

export default isListening;
