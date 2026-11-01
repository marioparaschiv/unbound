import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/**
 * A stand-in for the bundle CDN plus a file drop for the device. Bundle paths answer from the current variant's
 * folder with strong ETags and 304s, as the release bucket does; `/files/<name>` serves what {@link publish} added.
 */
export type BenchServer = {
	/** The origin the device reaches, such as `http://100.65.233.54:3110`. */
	origin: string;
	/** Points the bundle paths at a variant's built bundle folder. */
	serveBundle(folder: string): void;
	/** Makes a file or text downloadable at the returned URL. */
	publish(name: string, source: { path: string } | { text: string }): string;
	stop(): void;
};

/**
 * @description Starts the bench server on the address the device reaches this machine at.
 * @param host The address, from `DEV_HOST`.
 * @param port The port.
 * @returns The running server.
 */
export function startBenchServer(host: string, port: number): BenchServer {
	const files = new Map<string, { path: string } | { text: string }>();
	let bundles: string | undefined;

	const server = Bun.serve({
		hostname: host,
		port,
		fetch(request) {
			const path = decodeURIComponent(new URL(request.url).pathname);
			const file = path.startsWith('/files/')
				? files.get(path.slice('/files/'.length))
				: undefined;

			if (file) {
				return new Response('text' in file ? file.text : Bun.file(file.path));
			}

			const name = path.slice(1);

			if (!bundles || name.includes('/') || !existsSync(join(bundles, name))) {
				return new Response('Not Found', { status: 404 });
			}

			const body = readFileSync(join(bundles, name));
			const etag = `"${createHash('sha1').update(body).digest('hex')}"`;
			const headers = { ETag: etag, 'Cache-Control': 'no-cache' };

			return request.headers.get('if-none-match') === etag
				? new Response(null, { status: 304, headers })
				: new Response(body, { headers });
		},
	});
	const origin = `http://${host}:${server.port}`;

	return {
		origin,
		serveBundle(folder) {
			bundles = folder;
		},
		publish(name, source) {
			files.set(name, source);

			return `${origin}/files/${encodeURI(name)}`;
		},
		stop() {
			void server.stop(true);
		},
	};
}

export default { startBenchServer };
