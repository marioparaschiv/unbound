export type OwnRemovalKind = 'friends' | 'guilds' | 'groups';

export type OwnRemoval = {
	kind: OwnRemovalKind;
	id: string;
};

export type RemovalMethod = 'del' | 'post';

const API_PREFIX = /^(?:https?:\/\/[^/]+)?(?:\/api(?:\/v\d+)?)?/i;

const ROUTES: readonly { method: RemovalMethod; pattern: RegExp; kind: OwnRemovalKind }[] = [
	{ method: 'del', pattern: /^\/users\/@me\/relationships\/(\d+)$/, kind: 'friends' },
	{ method: 'del', pattern: /^\/users\/@me\/guilds\/(\d+)$/, kind: 'guilds' },
	{ method: 'post', pattern: /^\/guilds\/(\d+)\/delete$/, kind: 'guilds' },
	{ method: 'del', pattern: /^\/guilds\/(\d+)$/, kind: 'guilds' },
	{ method: 'del', pattern: /^\/channels\/(\d+)$/, kind: 'groups' },
];

function requestPath(request: unknown): string | undefined {
	const url =
		typeof request === 'string'
			? request
			: (request as { url?: unknown } | null | undefined)?.url;

	if (typeof url !== 'string') return undefined;

	const [path = ''] = url.split(/[?#]/);

	return path.replace(API_PREFIX, '').replace(/\/+$/, '');
}

/**
 * @description Recognises a request to Discord's API that removes a friend, request, server or group chat on the user's behalf.
 * @param method The REST client method the request goes through.
 * @param request The request, as a URL or an options object with `url`.
 * @returns What the request removes, or `undefined` for any other request.
 */
export function ownRemovalFromRequest(
	method: RemovalMethod,
	request: unknown,
): OwnRemoval | undefined {
	const path = requestPath(request);

	if (!path) return undefined;

	for (const route of ROUTES) {
		const id = route.method === method ? route.pattern.exec(path)?.[1] : undefined;

		if (id) return { kind: route.kind, id };
	}

	return undefined;
}
