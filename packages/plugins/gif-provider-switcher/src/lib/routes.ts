import { isRecord } from '@unbound-plugins/shared/values/is-record';

import { DEFAULT_LOCALE, DEFAULT_MEDIA_FORMAT } from '~/lib/constants';
import type { ProviderContext } from '~/lib/types';

export type HttpMethod = 'get' | 'post';

export type GifRoute =
	| { kind: 'search'; query: string; limit?: number }
	| { kind: 'suggest'; query: string }
	| { kind: 'trending' }
	| { kind: 'trending-gifs'; limit?: number }
	| { kind: 'select'; id: string; query: string }
	| { kind: 'integration'; integration: string; query: string; limit?: number };

export type MatchedRoute = {
	route: GifRoute;
	context: Partial<ProviderContext>;
};

type Params = Record<string, unknown>;

const API_PREFIX = /^(?:https?:\/\/[^/]+)?(?:\/api(?:\/v\d+)?)?/i;

function text(value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return String(value);
}

function count(value: unknown): number | undefined {
	const parsed = Number(text(value));

	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function splitUrl(url: string): { path: string; params: Params } {
	const [beforeHash = ''] = url.split('#');
	const [path = '', search = ''] = beforeHash.split('?');

	return {
		path: path.replace(API_PREFIX, '').replace(/\/+$/, ''),
		params: Object.fromEntries(new URLSearchParams(search)),
	};
}

function readRequest(request: unknown): { path: string; params: Params; body: Params } | null {
	const options = typeof request === 'string' ? { url: request } : request;

	if (!isRecord<Params>(options) || typeof options.url !== 'string') return null;

	const { path, params } = splitUrl(options.url);

	return {
		path,
		params: { ...params, ...(isRecord<Params>(options.query) ? options.query : {}) },
		body: isRecord<Params>(options.body) ? options.body : {},
	};
}

function readContext(params: Params): Partial<ProviderContext> {
	const locale = text(params.locale);
	const mediaFormat = text(params.media_format);

	return {
		...(locale ? { locale } : {}),
		...(mediaFormat ? { mediaFormat } : {}),
	};
}

function getRoute(path: string, params: Params): GifRoute | null {
	const query = text(params.q) ?? text(params.query) ?? '';
	const limit = count(params.limit);

	switch (path) {
		case '/gifs/search':
			return query.trim() ? { kind: 'search', query, limit } : null;
		case '/gifs/suggest':
			return query.trim() ? { kind: 'suggest', query } : null;
		case '/gifs/trending':
			return { kind: 'trending' };
		case '/gifs/trending-gifs':
			return { kind: 'trending-gifs', limit };
	}

	const integration = path.match(/^\/integrations\/([^/]+)\/search$/i)?.[1];

	return integration && query.trim()
		? { kind: 'integration', integration: decodeURIComponent(integration), query, limit }
		: null;
}

/**
 * @description Recognises a request Discord's HTTP client makes to its GIF endpoints, which serve Klipy results.
 * Reads the `url` (an endpoint path, with or without the API origin and version), the `query`, and for `POST /gifs/select` the `body`.
 * @param method The HTTP client method called.
 * @param request The argument Discord passed: an options object or a URL string.
 * @returns The GIF route and the locale and media format Discord asked for, or `null` for any other request.
 */
export function matchGifRoute(method: HttpMethod, request: unknown): MatchedRoute | null {
	const parsed = readRequest(request);

	if (!parsed) return null;

	const { path, params, body } = parsed;

	if (method === 'post') {
		const id = text(body.id);

		return path === '/gifs/select' && id
			? {
					route: { kind: 'select', id, query: text(body.q) ?? '' },
					context: readContext(params),
				}
			: null;
	}

	const route = getRoute(path, params);

	return route ? { route, context: readContext(params) } : null;
}

/**
 * @description Fills in the locale and media format a request left out, from the last ones Discord sent, then from defaults.
 * @param context What this request carried.
 * @param last What earlier requests carried.
 * @returns A complete context.
 */
export function resolveContext(
	context: Partial<ProviderContext>,
	last: Partial<ProviderContext> = {},
): ProviderContext {
	return {
		locale: context.locale ?? last.locale ?? DEFAULT_LOCALE,
		mediaFormat: context.mediaFormat ?? last.mediaFormat ?? DEFAULT_MEDIA_FORMAT,
	};
}
