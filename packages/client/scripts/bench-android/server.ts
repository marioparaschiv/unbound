import { safeParse } from '@unbound-app/contracts/schema';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { agentReportSchema, type AgentReport } from './schema';

export type { AgentReport } from './schema';

/** Answers each report; the agent waits on the response, so work done here happens before the agent continues. */
export type ReportHandler = (report: AgentReport) => Promise<void>;

/**
 * @description Serves each variant's bundle folder under `/<variant>/` with strong ETags, like the release CDN, and
 * takes the agent's reports at `/report`.
 * @param port The port; the emulator reaches the host's loopback at 10.0.2.2.
 * @param folders Each variant's bundle folder, by name.
 * @param onReport Handles a report.
 * @returns A function that stops the server.
 */
export function startServer(
	port: number,
	folders: Map<string, string>,
	onReport: ReportHandler,
): () => void {
	const server = Bun.serve({
		hostname: '127.0.0.1',
		port,
		async fetch(request) {
			const url = new URL(request.url);

			if (url.pathname === '/report' && request.method === 'POST') {
				const parsed = safeParse(agentReportSchema, await request.json());

				if (!parsed.success) {
					console.error('Failed to read an agent report:', parsed.error.message);

					return new Response('Bad Request', { status: 400 });
				}

				await onReport(parsed.data);

				return new Response('ok');
			}

			const [, variant, name, ...rest] = url.pathname.split('/');
			const folder = variant ? folders.get(variant) : void 0;

			if (!folder || !name || rest.length || !existsSync(join(folder, name))) {
				return new Response('Not Found', { status: 404 });
			}

			const data = readFileSync(join(folder, name));
			const etag = `"${createHash('sha1').update(data).digest('hex')}"`;
			const headers = { ETag: etag, 'Cache-Control': 'no-cache' };

			return request.headers.get('if-none-match') === etag
				? new Response(null, { status: 304, headers })
				: new Response(data, { headers });
		},
	});

	return () => void server.stop(true);
}
