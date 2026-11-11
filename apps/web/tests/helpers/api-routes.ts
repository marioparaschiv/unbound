import type { AnyRoute } from '@tanstack/react-router';
import { join } from 'node:path';

import { collectServedEndpoints, type ServedEndpoints } from '~/lib/api/openapi/served-operations';

const ROUTES = join(import.meta.dir, '../../src/routes/api/v1');

let served: Promise<ServedEndpoints> | undefined;

/**
 * @description Imports every `/api/v1` route file, the same files the server globs, as bun loads them.
 * @returns Each file's `Route`, keyed by its path under `src/`.
 */
export async function loadApiRoutes(): Promise<Record<string, AnyRoute>> {
	const files = [...new Bun.Glob('**/*.ts').scanSync(ROUTES)];
	const entries = await Promise.all(
		files.map(async (file) => {
			const module: { Route: AnyRoute } = await import(join(ROUTES, file));

			return [`routes/api/v1/${file}`, module.Route] as const;
		}),
	);

	return Object.fromEntries(entries);
}

/**
 * @description Lists every endpoint the `/api/v1` route files serve, loaded once per process.
 * @returns The endpoints, keyed as the API map keys them.
 */
export function loadServedEndpoints(): Promise<ServedEndpoints> {
	served ??= loadApiRoutes().then(collectServedEndpoints);

	return served;
}
