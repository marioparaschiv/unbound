import type { ApiErrorCode } from '@unbound-app/contracts/errors';
import type { z } from 'zod';

import type { Endpoint } from '~/lib/api/endpoint';
import type { AppContext } from '~/lib/context';
import { ApiRequestError } from '~/api/client';

export type AnyEndpoint = Endpoint<z.core.$ZodType, z.core.$ZodType, z.core.$ZodType>;

type MethodHandlers = Record<string, (request: Bun.BunRequest) => Promise<Response>>;

export type ApiFailure = {
	status: number;
	code: ApiErrorCode;
};

/**
 * @description Serves endpoints over HTTP on a random port, with Better Auth mounted at `/api/auth`,
 * so tests can call them through the typed API client and the auth client exactly as the routes would.
 * @param ctx The application context the endpoints run with.
 * @param endpoints The endpoints by `"METHOD /api/v1/path/$param"`, as in the API map.
 * @returns The running server.
 */
export function serveEndpoints(ctx: AppContext, endpoints: Record<string, AnyEndpoint>) {
	const routes: Record<string, MethodHandlers> = {};

	for (const [route, target] of Object.entries(endpoints)) {
		const [method = '', path = ''] = route.split(' ');
		const handlers = (routes[path.replaceAll('$', ':')] ??= {});

		handlers[method] = (request) => target.handle(ctx, request, request.params);
	}

	return Bun.serve({
		port: 0,
		routes: { ...routes, '/api/auth/*': (request) => ctx.auth.handler(request) },
	});
}

/**
 * @description Awaits a request expected to fail and returns its status and error code.
 * @param request The pending typed-client request.
 * @returns The failure.
 */
export async function failure(request: Promise<object>): Promise<ApiFailure> {
	const error = await request.then(
		() => new Error('Expected the request to fail.'),
		(cause: unknown) => cause,
	);

	if (!(error instanceof ApiRequestError)) {
		throw error;
	}

	return { status: error.status, code: error.code };
}
