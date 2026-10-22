import type { z } from 'zod';

import type { Endpoint, PathParams } from '~/lib/api/endpoint';
import app from '~/lib/app';

export type ServerHandlerArgs = {
	request: Request;
	params: PathParams;
};

/** A TanStack Start server route handler that remembers which endpoint it serves, for the API map. */
export type ServedEndpoint<E> = ((args: ServerHandlerArgs) => Promise<Response>) & {
	endpoint: E;
};

/**
 * @description Binds an endpoint to the process-wide app context as a server route handler.
 * @param target The endpoint to serve.
 * @returns The handler to place under a method in `server.handlers`.
 */
export function serve<
	TBody extends z.core.$ZodType,
	TResponse extends z.core.$ZodType,
	TQuery extends z.core.$ZodType,
>(target: Endpoint<TBody, TResponse, TQuery>): ServedEndpoint<Endpoint<TBody, TResponse, TQuery>> {
	return Object.assign(
		({ request, params }: ServerHandlerArgs) => target.handle(app, request, params),
		{
			endpoint: target,
		},
	);
}

export default serve;
