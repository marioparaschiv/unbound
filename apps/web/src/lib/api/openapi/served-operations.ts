import type { TSchema } from '@unbound-app/contracts/schema';
import type { AnyRoute } from '@tanstack/react-router';

import {
	buildOpenApiDocument,
	type DocumentedOperation,
	type HttpMethod,
	type OpenApiDocument,
} from '~/lib/api/openapi/openapi-document';
import { PUBLIC_OPERATIONS, type PublicOperation } from '~/lib/api/openapi/public-operations';
import type { ServedEndpoint } from '~/lib/api/serve';
import type { Endpoint } from '~/lib/api/endpoint';
import { version } from '~/../package.json';

type AnyEndpoint = Endpoint<TSchema, TSchema, TSchema>;

/** A route method's endpoint, by its API map key such as `GET /api/v1/catalog`. */
export type ServedEndpoints = Map<string, AnyEndpoint>;

const METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// A plain or `$param` segment, or one with `[.]` escapes. Layouts, groups, `index`, `route` and flat
// `a.b` names map to paths differently, so they fail rather than be guessed at.
const ROUTE_SEGMENT = /^(?!_|index$|route$)(?:\$?[a-z\d-]+|[a-z\d-]+(?:\[\.\][a-z\d-]+)+)$/i;

/** A route's server handlers by method: `serve`d endpoints or plain functions. */
type RouteHandlers = Partial<Record<string, CallableFunction>>;

function isServedEndpoint(
	handler: CallableFunction | undefined,
): handler is ServedEndpoint<AnyEndpoint> {
	return handler !== undefined && 'endpoint' in handler;
}

function isHttpMethod(value: string | undefined): value is HttpMethod {
	return METHODS.some((method) => method === value);
}

/**
 * @description Maps a file under `routes/` to the path TanStack's file routing serves it at, for the
 * plain directory layout `/api` uses.
 * @param file The route file, such as `src/routes/api/v1/addons/$id/versions.ts`.
 * @returns The path, such as `/api/v1/addons/$id/versions`.
 */
export function toRoutePath(file: string): string {
	const segments = file
		.slice(file.indexOf('routes/') + 'routes/'.length)
		.replace(/\.tsx?$/, '')
		.split('/');

	if (!segments.every((segment) => ROUTE_SEGMENT.test(segment))) {
		throw new Error(
			`Failed to map route file ${file} to a path: only plain segments are supported.`,
		);
	}

	return `/${segments.join('/').replaceAll('[.]', '.')}`;
}

/**
 * @description Lists every endpoint the given route modules serve, keyed as the API map keys them.
 * @param routes Each route file's `Route`, by file path.
 * @returns The endpoints.
 */
export function collectServedEndpoints(routes: Record<string, AnyRoute>): ServedEndpoints {
	const served: ServedEndpoints = new Map();

	for (const [file, route] of Object.entries(routes)) {
		const path = toRoutePath(file);
		const handlers: RouteHandlers | undefined = route.options.server?.handlers;

		for (const method of METHODS) {
			const handler = handlers?.[method];

			if (isServedEndpoint(handler)) {
				served.set(`${method} ${path}`, handler.endpoint);
			}
		}
	}

	return served;
}

// Only the API's own route modules, not the route tree, so `/api` never reaches the rest of the app.
// Globbed in here, not at module scope, so tests can import this module outside Vite.
async function loadApiRoutes(): Promise<Record<string, AnyRoute>> {
	const routes = import.meta.glob<AnyRoute>('../../../routes/api/v1/**/*.ts', {
		import: 'Route',
	});
	const entries = await Promise.all(
		Object.entries(routes).map(async ([file, load]) => [file, await load()] as const),
	);

	return Object.fromEntries(entries);
}

/**
 * @description Pairs each public operation with the endpoint its route serves. Fails when one is not
 * served or requires a caller, so an authenticated endpoint is never documented as public.
 * @param served The API routes' endpoints.
 * @returns The operations to document, in registry order.
 */
export function listPublicOperations(served: ServedEndpoints): DocumentedOperation[] {
	const entries: [string, PublicOperation][] = Object.entries(PUBLIC_OPERATIONS);

	return entries.map(([key, operation]) => {
		const [method, path = ''] = key.split(' ');
		const endpoint = served.get(key);

		if (!endpoint || !isHttpMethod(method)) {
			throw new Error(`Public operation ${key} is not served by any route.`);
		}

		if (endpoint.access !== 'public') {
			throw new Error(`Public operation ${key} requires a caller.`);
		}

		return { method, path, endpoint, operation };
	});
}

let built: Promise<OpenApiDocument> | undefined;

/**
 * @description Builds the OpenAPI document of the public operations once per process, from the
 * `/api/v1` route files.
 * @param serverUrl The origin the API is served from.
 * @returns The document.
 */
export function getOpenApiDocument(serverUrl: string): Promise<OpenApiDocument> {
	// Loaded lazily: one of the routes serves this document.
	built ??= loadApiRoutes().then((routes) =>
		buildOpenApiDocument(listPublicOperations(collectServedEndpoints(routes)), {
			serverUrl,
			version,
		}),
	);

	return built;
}

export default { collectServedEndpoints, listPublicOperations, getOpenApiDocument };
