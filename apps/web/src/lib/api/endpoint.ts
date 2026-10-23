import { createLogger } from '@unbound-app/logger';
import { z } from 'zod';

import type { AppContext } from '~/lib/context';
import { ApiError } from '~/lib/api/errors';

const logger = createLogger('Web', 'API');

/** The route's `$param` path segments, by name. */
export type PathParams = Record<string, string>;

export type EndpointInput<TBody, TQuery> = {
	ctx: AppContext;
	request: Request;
	params: PathParams;
	body: TBody;
	query: TQuery;
};

export type EndpointSchemas<
	TBody extends z.core.$ZodType,
	TResponse extends z.core.$ZodType,
	TQuery extends z.core.$ZodType,
> = {
	/** `z.undefined()` for body-less requests. */
	body: TBody;
	/**
	 * The URL search parameters as a string record, or `undefined` when the URL has none; `z.undefined()`
	 * for routes that take none.
	 */
	query: TQuery;
	response: TResponse;
};

export type EndpointOptions<TResponse extends z.core.$ZodType> = {
	/**
	 * Derives the response's entity tag. When set, the response carries it as a strong `ETag` and a
	 * request whose `If-None-Match` lists it is answered `304` with no body.
	 */
	etag?: (result: z.output<TResponse>) => string;
};

/** A `/api/v1` handler bound to the contract schemas its request and response follow. */
export type Endpoint<
	TBody extends z.core.$ZodType,
	TResponse extends z.core.$ZodType,
	TQuery extends z.core.$ZodType,
> = {
	schemas: EndpointSchemas<TBody, TResponse, TQuery>;
	handle(ctx: AppContext, request: Request, params?: PathParams): Promise<Response>;
};

// UNKNOWN: the raw JSON body, validated by the endpoint's body schema next.
async function readJson(request: Request): Promise<unknown> {
	// Behind the TanStack Start server a bodiless POST still carries an empty body stream.
	const text = await request.text();

	if (!text) return;

	try {
		return JSON.parse(text);
	} catch {
		throw new ApiError('invalid_request', 'The request body must be JSON.');
	}
}

function matchesIfNoneMatch(request: Request, etag: string): boolean {
	const header = request.headers.get('if-none-match');

	if (!header) {
		return false;
	}

	// `If-None-Match` uses the weak comparison, so `W/"x"` matches `"x"`.
	return header
		.split(',')
		.some((tag) => tag.trim() === '*' || tag.trim().replace(/^W\//, '') === etag);
}

// UNKNOWN: request input, validated by the endpoint's schema.
function parseInput<TSchema extends z.core.$ZodType>(
	schema: TSchema,
	input: unknown,
): z.output<TSchema> {
	const result = z.safeParse(schema, input);

	if (!result.success) {
		throw new ApiError('invalid_request', z.prettifyError(result.error));
	}

	return result.data;
}

/**
 * @description Defines a JSON endpoint: parses the body and query against their contract schemas,
 * runs the handler, validates the result against the response schema, and renders an
 * {@link ApiError} as the `{ error: { code, message } }` body. Anything else is logged and answered
 * with `internal_error`.
 * @param schemas The request body, query and response schemas.
 * @param handler The endpoint logic.
 * @param options Conditional-request support, e.g. an `etag` derived from the result.
 * @returns The endpoint, served from a route with `serve` and called directly from tests.
 */
export function endpoint<
	TBody extends z.core.$ZodType,
	TResponse extends z.core.$ZodType,
	TQuery extends z.core.$ZodType,
>(
	schemas: EndpointSchemas<TBody, TResponse, TQuery>,
	handler: (
		input: EndpointInput<z.output<TBody>, z.output<TQuery>>,
	) => Promise<z.input<TResponse>>,
	options: EndpointOptions<TResponse> = {},
): Endpoint<TBody, TResponse, TQuery> {
	return {
		schemas,
		async handle(ctx, request, params = {}) {
			const { pathname, searchParams } = new URL(request.url);

			try {
				const body = parseInput(schemas.body, await readJson(request));
				const query = parseInput(
					schemas.query,
					searchParams.size > 0 ? Object.fromEntries(searchParams) : undefined,
				);
				const result = z.parse(
					schemas.response,
					await handler({ ctx, request, params, body, query }),
				);

				if (!options.etag) {
					return Response.json(result);
				}

				const etag = `"${options.etag(result)}"`;
				// `no-cache` lets clients keep the body but revalidate it on every use.
				const headers = { ETag: etag, 'Cache-Control': 'no-cache' };

				if (matchesIfNoneMatch(request, etag)) {
					return new Response(null, { status: 304, headers });
				}

				return Response.json(result, { headers });
			} catch (error) {
				if (error instanceof ApiError) {
					return error.toResponse();
				}

				logger.error(`Failed to handle ${request.method} ${pathname}:`, error);

				return new ApiError('internal_error', 'Something went wrong.').toResponse();
			}
		},
	};
}

/**
 * @description Reads a `$param` path segment, failing with `invalid_request` when it is missing.
 * @param params The route's path parameters.
 * @param name The parameter name.
 * @returns The parameter value.
 */
export function requireParam(params: PathParams, name: string): string {
	const value = params[name];

	if (!value) {
		throw new ApiError('invalid_request', `The ${name} path parameter is required.`);
	}

	return value;
}

/**
 * @description Reads a `$param` path segment and parses it, failing with `invalid_request` when it is
 * missing or the schema refuses it.
 * @template TSchema The schema the segment must satisfy.
 * @param params The route's path parameters.
 * @param name The parameter name.
 * @param schema The schema the segment must satisfy.
 * @returns The parsed parameter.
 */
export function parseParam<TSchema extends z.ZodType>(
	params: PathParams,
	name: string,
	schema: TSchema,
): z.output<TSchema> {
	return parseInput(schema, requireParam(params, name));
}

export default endpoint;
