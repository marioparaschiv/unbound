import Logger from '@unbound-app/logger';
import { format } from 'date-fns';
import { join } from 'node:path';
import { file } from 'bun';

import { DIST_DIR } from './constants';

const logger = Logger.create('Serve');

/**
 * @description Formats a byte count as a human-readable size string.
 * @param bytes The number of bytes.
 * @returns The formatted size, e.g. `1.50 KB`.
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * @description Serves a file from `dist/` for a GET request, guarding against path traversal and
 * logging the outcome.
 * @param pathname The request pathname (e.g. `/unbound.bundle`).
 * @returns The file response, or a 403/404/500 on failure.
 */
export async function serveStatic(pathname: string): Promise<Response> {
	const startTime = performance.now();

	try {
		const filePath = join(DIST_DIR, pathname.slice(1));

		if (!filePath.startsWith(DIST_DIR)) {
			logger.error(`GET ${pathname} - Path traversal attempt blocked`);
			return new Response('Forbidden', { status: 403 });
		}

		const f = file(filePath);
		const exists = await f.exists();

		if (!exists) {
			logger.warn(`GET ${pathname} - File not found`);
			return new Response('Not Found', { status: 404 });
		}

		const duration = (performance.now() - startTime).toFixed(2);

		logger.success(
			`(${format(Date.now(), 'HH:mm:ss')}) GET ${pathname} - ${formatBytes(f.size)} in ${duration}ms`,
		);

		return new Response(f, {
			headers: {
				'Content-Type': f.type,
				'Access-Control-Allow-Origin': '*',
			},
		});
	} catch (error: any) {
		const duration = (performance.now() - startTime).toFixed(2);
		logger.error(`GET ${pathname} - Error after ${duration}ms:`, error.message);
		return new Response('Internal Server Error', { status: 500 });
	}
}

export default serveStatic;
