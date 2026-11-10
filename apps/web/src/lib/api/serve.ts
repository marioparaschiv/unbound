import type { TSchema } from '@unbound-app/contracts/schema';

import type { Endpoint, PathParams } from '~/lib/api/endpoint';
import { getApp } from '~/lib/app';

export type ServerHandlerArgs = {
	request: Request;
	params: PathParams;
};

/** A TanStack Start server route handler that remembers which endpoint it serves, for the API map. */
export type ServedEndpoint<E> = ((args: ServerHandlerArgs) => Promise<Response>) & {
	endpoint: E;
};

/**
 * @description Binds an endpoint to the process-wide app context, resolved per request, as a server
 * route handler. Importing a route therefore opens nothing.
 * @param target The endpoint to serve.
 * @returns The handler to place under a method in `server.handlers`.
 */
export function serve<TBody extends TSchema, TResponse extends TSchema, TQuery extends TSchema>(
	target: Endpoint<TBody, TResponse, TQuery>,
): ServedEndpoint<Endpoint<TBody, TResponse, TQuery>> {
	return Object.assign(
		({ request, params }: ServerHandlerArgs) => target.handle(getApp(), request, params),
		{
			endpoint: target,
		},
	);
}

export default serve;
