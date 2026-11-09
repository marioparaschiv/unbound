import Logger from '@unbound-app/logger';
import { format } from 'date-fns';
import { join } from 'node:path';

import { DIST_DIR, BUNDLE_PATTERN } from './constants';
import { bundleEtag } from './hot-reload';

const logger = Logger.create('Serve');

/**
 * @description Formats a byte count as a human-readable size string.
 * @param bytes The number of bytes.
 * @returns The formatted size, e.g. `1.50 KB`.
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) {
		return '0 B';
	}

	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * @description Serves a file from `dist/` for a GET request, guarding against path traversal and
 * logging the outcome.
 * @param pathname The request pathname (e.g. `/unbound.98.bundle`).
 * @param ifNoneMatch The request's `If-None-Match` header, the etag of the bundle the loader holds.
 * @returns The file response, a 304 when the loader's bundle is current, or a 403/404/500 on failure.
 */
export async function serveStatic(
	pathname: string,
	ifNoneMatch?: string | null,
): Promise<Response> {
	const startTime = performance.now();

	try {
		const filePath = join(DIST_DIR, pathname.slice(1));

		if (!filePath.startsWith(DIST_DIR)) {
			logger.error(`GET ${pathname} - Path traversal attempt blocked`);

			return new Response('Forbidden', { status: 403 });
		}

		const file = Bun.file(filePath);
		const exists = await file.exists();

		if (!exists) {
			logger.warn(`GET ${pathname} - File not found`);

			return new Response('Not Found', { status: 404 });
		}

		const isBundle = BUNDLE_PATTERN.test(pathname.slice(1));
		const etag = isBundle ? bundleEtag() : '';

		// Without the 304, the loader saves every launch's download as a new bundle and restarts Discord to run it.
		if (etag && ifNoneMatch === etag) {
			logger.success(
				`(${format(Date.now(), 'HH:mm:ss')}) GET ${pathname} - 304 Not Modified`,
			);

			return new Response(null, { status: 304, headers: { ETag: etag } });
		}

		const duration = (performance.now() - startTime).toFixed(2);

		logger.success(
			`(${format(Date.now(), 'HH:mm:ss')}) GET ${pathname} - ${formatBytes(file.size)} in ${duration}ms`,
		);

		const headers: Record<string, string> = {
			'Content-Type': file.type,
			'Access-Control-Allow-Origin': '*',
		};

		// Tag every bundle variant with the build's hash - the SSE `reload` carries the same value, so
		// the device can compare the two. `no-cache` forces the device to always revalidate.
		if (isBundle) {
			headers['ETag'] = etag;
			headers['Cache-Control'] = 'no-cache';
		}

		return new Response(file, { headers });
	} catch (error) {
		const duration = (performance.now() - startTime).toFixed(2);
		const message = error instanceof Error ? error.message : error;

		logger.error(`GET ${pathname} - Error after ${duration}ms:`, message);

		return new Response('Internal Server Error', { status: 500 });
	}
}

export default serveStatic;
