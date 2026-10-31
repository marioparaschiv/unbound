import { createLogger } from '@unbound-app/logger';
import { join } from 'node:path';

import { parseEnv } from '~/lib/env';

const logger = createLogger('Web', 'Serve');
const env = parseEnv();

const dist = join(import.meta.dirname, '..', 'dist');
const { default: server } = await import(join(dist, 'server', 'server.js'));

const assets = new Bun.Glob('**/*');
const routes: Record<string, Bun.BunFile | Response> = {};

// Vite content-hashes everything under assets/, so a URL there never changes content. Public files keep their names.
const IMMUTABLE = { 'cache-control': 'public, max-age=31536000, immutable' };

for await (const path of assets.scan(join(dist, 'client'))) {
	const file = Bun.file(join(dist, 'client', path));

	routes[`/${path}`] = path.startsWith('assets/')
		? new Response(file, { headers: IMMUTABLE })
		: file;
}

Bun.serve({
	port: env.PORT,
	routes,
	fetch: (request) => server.fetch(request),
});

logger.success(`Serving ${Object.keys(routes).length} assets and the app on port ${env.PORT}.`);
