import type { StaticDecode } from '@unbound-app/contracts/schema';
import { parse } from '@unbound-app/contracts/schema';

import { sendRequest, type ApiClientOptions, type ApiMap, type RequestOptions } from './client';

export type {
	ApiClientOptions,
	ApiMap,
	ApiRoute,
	CheckedRequestOptions,
	QueryValues,
	RequestOptions,
	ResponseCheck,
} from './client';
export {
	API_KEY_HEADER,
	ApiRequestError,
	CLI_CLIENT_ID,
	NotModifiedError,
	sendRequest,
} from './client';

/**
 * @description Creates a typed client for the Unbound web API that parses each answer with the
 * route's contract schema: defaults filled, undeclared keys stripped, codecs decoded. For callers
 * that already ship the schema, such as the CLI and the web app; the React Native client uses the
 * generated checks in `~/api/client` instead, so no validator library reaches its bundle.
 * @template Api The API map, `Api` from `@unbound-app/web/api`.
 * @param options The API origin and headers sent with every request (e.g. credentials).
 * @returns A `request(route, options)` function taking the route's response schema.
 */
export function createApiClient<Api extends ApiMap>(options: ApiClientOptions) {
	return async function request<K extends keyof Api & string>(
		route: K,
		init: RequestOptions<K, Api[K]>,
	): Promise<StaticDecode<Api[K]['response']>> {
		return parse(init.response, await sendRequest(options, route, init));
	};
}

export default { createApiClient };
