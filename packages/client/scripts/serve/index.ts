import Logger from '@unbound-app/logger';
import { format } from 'date-fns';
import { join } from 'node:path';
import { file } from 'bun';

const logger = Logger.create('Serve');
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = join(__dirname, '..', '..', 'dist');

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

const server = Bun.serve({
	port: PORT,
	hostname: HOST,
	async fetch(req) {
		const startTime = performance.now();
		const url = new URL(req.url);
		const pathname = url.pathname;

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
	},
});

logger.info(`Server running at http://${HOST}:${PORT}/`);
logger.info(`Serving files from: ${DIST_DIR}`);
logger.log('Press Ctrl+C to stop');

process.on('SIGINT', () => {
	logger.newLine();
	logger.log('Shutting down server...');
	server.stop();
	logger.success('Server stopped');
	process.exit(0);
});
