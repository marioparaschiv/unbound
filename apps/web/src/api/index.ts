import type { StaticEncode } from '@unbound-app/contracts/schema';

import type { FileRoutesByFullPath } from '~/routeTree.gen';
import type { ServedEndpoint } from '~/lib/api/serve';
import type { Endpoint } from '~/lib/api/endpoint';
import type { ApiRoute } from '~/api/client';

// `handlers` may also be a factory function; only the plain method record carries endpoint types.
type Handlers<R> = R extends { options: { server?: { handlers?: infer H } } }
	? Exclude<NonNullable<H>, CallableFunction>
	: never;

type RouteEntry<H> =
	H extends ServedEndpoint<Endpoint<infer TBody, infer TResponse, infer TQuery>>
		? { body: StaticEncode<TBody>; query: StaticEncode<TQuery>; response: TResponse }
		: never;

/** Maps every `serve`d handler of a server route to its `"METHOD /path"` API map entry. */
type RouteApi<R extends { fullPath: keyof FileRoutesByFullPath }> = {
	[
		M in keyof Handlers<R> & string as RouteEntry<Handlers<R>[M]> extends never
			? never
			: `${M} ${R['fullPath']}`
	]: RouteEntry<Handlers<R>[M]>;
};

type RouteApis = { [P in keyof FileRoutesByFullPath]: RouteApi<FileRoutesByFullPath[P]> };

type RouteApiUnion = RouteApis[keyof RouteApis];

type RouteKey<T> = T extends object ? keyof T & string : never;

// Importing the generated route tree also brings its route type augmentations into consumers' programs.
/** The typed map of every `/api/v1` route, for `createApiClient<Api>()`. Type-only: import with `import type`. */
export type Api = {
	[K in RouteKey<RouteApiUnion>]: Extract<RouteApiUnion, Record<K, ApiRoute>>[K];
};
