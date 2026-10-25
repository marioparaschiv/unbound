import type { Socket, TCPSocketListener } from 'bun';

type Pipe = {
	upstream: Socket | undefined;
	pending: Uint8Array[];
};

export type TcpProxy = {
	/** `target` with its host and port pointed at the proxy. */
	url: string;
	/** Closes the listening socket and every proxied connection. */
	down: () => void;
	/** Listens again on the same port. */
	up: () => void;
};

/**
 * @description Forwards TCP connections on a local port to the host and port of a Postgres URL.
 * @param target The connection string to proxy.
 * @returns The proxied URL and `down()`/`up()` to simulate an outage.
 */
export function createTcpProxy(target: string): TcpProxy {
	const upstream = new URL(target);
	const clients = new Set<Socket<Pipe>>();

	function serve(port: number): TCPSocketListener<Pipe> {
		return Bun.listen<Pipe>({
			hostname: '127.0.0.1',
			port,
			socket: {
				open(client) {
					client.data = { upstream: undefined, pending: [] };
					clients.add(client);

					Bun.connect({
						hostname: upstream.hostname,
						port: Number(upstream.port || 5432),
						socket: {
							open(socket) {
								client.data.upstream = socket;

								for (const chunk of client.data.pending) {
									socket.write(chunk);
								}

								client.data.pending = [];
							},
							data: (_, chunk) => void client.write(chunk),
							close: () => void client.end(),
							error: () => void client.end(),
						},
					}).catch(() => client.end());
				},
				data(client, chunk) {
					if (client.data.upstream) {
						client.data.upstream.write(chunk);

						return;
					}

					client.data.pending.push(chunk);
				},
				close(client) {
					clients.delete(client);
					client.data.upstream?.end();
				},
				error: (client) => void client.end(),
			},
		});
	}

	let server = serve(0);
	const { port } = server;
	const proxied = new URL(target);

	proxied.hostname = '127.0.0.1';
	proxied.port = String(port);

	return {
		url: proxied.toString(),
		down() {
			server.stop(true);

			for (const client of clients) {
				client.end();
			}
		},
		up() {
			server = serve(port);
		},
	};
}
