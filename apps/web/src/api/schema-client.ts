import type { StaticDecode } from '@unbound-app/contracts/schema';
import { parse } from '@unbound-app/contracts/schema';

import {
	sendRequest,
	type ApiClientOptions,
	type ApiMap,
	type ApiRoute,
	type RequestOptions,
} from './client';

export {
	API_KEY_HEADER,
	ApiRequestError,
	CLI_CLIENT_ID,
	NotModifiedError,
	sendRequest,
} from './client';
export type { ApiClientOptions, ApiMap, ApiRoute, QueryValues, RequestOptions } from './client';

/** A request's options plus the route's contract response schema, which the answer is parsed with. */
export type SchemaRequestOptions<K, R extends ApiRoute> = RequestOptions<K, R> & {
	/** The compiler checks it is the schema the route declares. */
	response: R['response'];
};

/**
 * @description Creates a typed client for the Unbound web API that parses each answer with the
 * route's contract schema: defaults filled, undeclared keys stripped, codecs decoded. For callers
 * that already ship the schema, such as the CLI and the web app; the React Native client trusts the
 * answer through `~/api/client` instead, so no validator reaches its bundle.
 * @template Api The API map, `Api` from `@unbound-app/web/api`.
 * @param options The API origin and headers sent with every request (e.g. credentials).
 * @returns A `request(route, options)` function taking the route's response schema.
 */
export function createApiClient<Api extends ApiMap>(options: ApiClientOptions) {
	return async function request<K extends keyof Api & string>(
		route: K,
		init: SchemaRequestOptions<K, Api[K]>,
	): Promise<StaticDecode<Api[K]['response']>> {
		return parse(init.response, await sendRequest(options, route, init));
	};
}

export default { createApiClient };
