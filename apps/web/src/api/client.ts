import type { StaticDecode, TSchema } from '@unbound-app/contracts/schema';
import { isApiErrorCode } from '@unbound-app/contracts/api-error-codes';
import type { ApiErrorCode } from '@unbound-app/contracts/errors';
import { SchemaError } from '@unbound-app/contracts/schema-error';

/** The header `ubd publish` sends an API key in, for CI publishing. */
export const API_KEY_HEADER = 'x-api-key';

/** The OAuth `client_id` `ubd login` sends to the device authorization endpoints. */
export const CLI_CLIENT_ID = 'ubd';

/** URL search parameters as a route's query schema accepts them. */
export type QueryValues = Record<string, string | undefined>;

/** One `"METHOD /path"` entry of the API map: the request body and query types and the response schema. */
export type ApiRoute = {
	body: unknown;
	query: QueryValues | undefined;
	response: TSchema;
};

export type ApiMap = Record<string, ApiRoute>;

// The DOM's `HeadersInit` is missing where only Bun's types are loaded, as in the CLI.
type HeaderValues = ConstructorParameters<typeof Headers>[0];

type PathOf<K> = K extends `${string} ${infer Path}` ? Path : never;

type ParamNames<Path> = Path extends `${string}$${infer Param}/${infer Rest}`
	? Param | ParamNames<Rest>
	: Path extends `${string}$${infer Param}`
		? Param
		: never;

type ParamsOption<K> = [ParamNames<PathOf<K>>] extends [never]
	? { params?: never }
	: { params: Record<ParamNames<PathOf<K>>, string> };

type BodyOption<R extends ApiRoute> = undefined extends R['body']
	? { body?: R['body'] }
	: { body: R['body'] };

// A query whose every field is optional may be left out, as an empty search string.
type QueryOption<R extends ApiRoute> = undefined extends R['query']
	? { query?: R['query'] }
	: {} extends R['query']
		? { query?: R['query'] }
		: { query: R['query'] };

/** Checks a response body against a route's contract, narrowing it to the schema's decoded type. */
export type ResponseCheck<T> = (value: unknown) => value is T;

// `parse` decoded codecs and filled defaults, which a generated check leaves to its call site; the
// type a route answers with is therefore the schema's decoded type either way.
export type CheckedRequestOptions<K, R extends ApiRoute> = ParamsOption<K> &
	BodyOption<R> &
	QueryOption<R> & {
		/** The generated check for the route's contract response; the compiler checks it is that schema's. */
		response: ResponseCheck<StaticDecode<R['response']>>;
		headers?: HeaderValues;
	};

/** What a request sends besides its route: the path parameters, query, body and extra headers. */
export type RequestParts = {
	params?: Record<string, string>;
	query?: QueryValues;
	body?: unknown;
	headers?: HeaderValues;
};

/** The options a request sends to the API: everything but how its response is read. */
export type RequestOptions<K, R extends ApiRoute> = ParamsOption<K> &
	BodyOption<R> &
	QueryOption<R> & {
		/** The route's contract response schema; the compiler checks it is the one the route declares. */
		response: R['response'];
		headers?: HeaderValues;
	};

export type ApiClientOptions = {
	baseUrl: string;
	headers?: HeaderValues;
};

/** A non-2xx response from the API, carrying the contract error code. */
export class ApiRequestError extends Error {
	constructor(
		public readonly code: ApiErrorCode,
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = 'ApiRequestError';
	}
}

/** A `304 Not Modified` answer to a conditional request: the copy the caller holds is current. */
export class NotModifiedError extends Error {
	constructor() {
		super('Not modified.');
		this.name = 'NotModifiedError';
	}
}

function buildUrl(
	baseUrl: string,
	path: string,
	params: Record<string, string> | undefined,
	query: QueryValues | undefined,
): URL {
	const url = new URL(buildPath(path, params), baseUrl);

	for (const [name, value] of Object.entries(query ?? {})) {
		if (value === undefined) {
			continue;
		}

		url.searchParams.set(name, value);
	}

	return url;
}

function buildPath(path: string, params: Record<string, string> | undefined): string {
	return path.replaceAll(/\$(\w+)/g, (_, name: string) => {
		const value = params?.[name];

		if (value === undefined) {
			throw new Error(`Missing path parameter ${name} for ${path}.`);
		}

		return encodeURIComponent(value);
	});
}

// UNKNOWN: an error body before its schema runs.
function isErrorBody(value: unknown): value is { error: { code: ApiErrorCode; message: string } } {
	if (typeof value !== 'object' || value === null || !('error' in value)) {
		return false;
	}

	const { error } = value;

	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		isApiErrorCode(error.code) &&
		'message' in error &&
		typeof error.message === 'string'
	);
}

async function toRequestError(response: Response): Promise<ApiRequestError> {
	const body: unknown = await response.json().catch(() => null);

	if (!isErrorBody(body)) {
		return new ApiRequestError(
			'internal_error',
			response.status,
			`Unexpected ${response.status} response without an error body.`,
		);
	}

	return new ApiRequestError(body.error.code, response.status, body.error.message);
}

/**
 * @description Sends one request and returns its JSON body, throwing an {@link ApiRequestError} for a
 * non-2xx answer and a {@link NotModifiedError} for a `304` to a conditional request.
 * @param options The API origin and headers sent with every request (e.g. credentials).
 * @param route The `"METHOD /path"` route, with `$param` segments.
 * @param init The path parameters, query, body and per-request headers.
 * @returns The parsed body, still unchecked: the caller validates it against the route's contract.
 */
// UNKNOWN: the body of a route, which the caller checks against its contract.
export async function sendRequest(
	options: ApiClientOptions,
	route: string,
	init: RequestParts,
): Promise<unknown> {
	const separator = route.indexOf(' ');
	const method = route.slice(0, separator);
	const path = route.slice(separator + 1);
	const headers = new Headers(options.headers);

	for (const [name, value] of new Headers(init.headers)) {
		headers.set(name, value);
	}

	if (init.body !== undefined) {
		headers.set('content-type', 'application/json');
	}

	const url = buildUrl(options.baseUrl, path, init.params, init.query);
	const response = await fetch(url, {
		method,
		headers,
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	});

	if (response.status === 304) {
		throw new NotModifiedError();
	}

	if (!response.ok) {
		throw await toRequestError(response);
	}

	return response.json();
}

/**
 * @description Creates a typed client for the Unbound web API. Routes, bodies and responses are
 * checked against the API map exported by `@unbound-app/web/api`; each answer is checked by the
 * route's generated contract check, and `{ error: { code, message } }` bodies are thrown as
 * {@link ApiRequestError}. A `304` to a conditional request is thrown as {@link NotModifiedError}.
 * @template Api The API map, `Api` from `@unbound-app/web/api`.
 * @param options The API origin and headers sent with every request (e.g. credentials).
 * @returns A `request(route, options)` function taking the route's generated check.
 */
export function createApiClient<Api extends ApiMap>(options: ApiClientOptions) {
	return async function request<K extends keyof Api & string>(
		route: K,
		init: CheckedRequestOptions<K, Api[K]>,
	): Promise<StaticDecode<Api[K]['response']>> {
		const body = await sendRequest(options, route, init);

		if (!init.response(body)) {
			throw new SchemaError([{ path: '', message: 'Response did not match the contract.' }]);
		}

		return body;
	};
}

export default {
	API_KEY_HEADER,
	CLI_CLIENT_ID,
	ApiRequestError,
	NotModifiedError,
	createApiClient,
	sendRequest,
};
