// Fetch test substrate. Carries only the slice of the `fetch` contract the install path consumes -
// `ok`, `status`, and the `json()`/`text()` body readers - plus a call log recording every url and
// its init options. It models no headers, no redirects, no streaming and no network.

/** A single route's response: its status and the body the readers resolve to. */
export interface RouteResponse {
	ok?: boolean;
	status?: number;
	/** The raw body `text()` resolves to, and `json()` parses when `json` is absent. */
	body?: string;
	/** A pre-parsed body for `json()`, bypassing `body` so a route can serve valid JSON directly. */
	json?: unknown;
}

/** The routes to serve, keyed by the exact url the unit under test is expected to request. */
export type RouteMap = Record<string, RouteResponse>;

/** One recorded `fetch` invocation, in issue order. */
export interface FetchCall {
	url: string;
	init: RequestInit | undefined;
}

/** The handle returned by `installFetchMock`: the call log and a restore for per-test isolation. */
export interface FetchMock {
	calls: FetchCall[];
	restore(): void;
}

function makeResponse(route: RouteResponse): Response {
	const ok = route.ok ?? true;
	const body = route.body ?? (route.json === undefined ? '' : JSON.stringify(route.json));

	const response = {
		ok,
		status: route.status ?? (ok ? 200 : 404),
		text: async () => body,
		json: async () => (route.json === undefined ? JSON.parse(body) : route.json),
	};

	return response as Response;
}

/**
 * @description Replaces the global `fetch` with a route table, recording every call. An unrouted url
 * rejects, so a wrong bundle-url resolution fails loudly instead of silently serving the manifest.
 * @param routes The url-to-response map to serve.
 * @returns A handle exposing the recorded calls and a restore of the original `fetch`.
 */
export function installFetchMock(routes: RouteMap): FetchMock {
	const calls: FetchCall[] = [];
	const original = globalThis.fetch;

	const stub = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const url = String(input);
		calls.push({ url, init });

		const route = routes[url];
		if (!route) throw new Error(`No route registered for ${url}`);

		return makeResponse(route);
	};

	// `fetch` carries a `preconnect` sibling nothing here exercises; forward the real one so the
	// global keeps its full shape.
	globalThis.fetch = Object.assign(stub, { preconnect: original.preconnect });

	return {
		calls,
		restore: () => void (globalThis.fetch = original),
	};
}

export default { installFetchMock };
