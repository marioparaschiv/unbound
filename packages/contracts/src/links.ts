import { addonIdSchema } from './manifest';

/** The URL scheme the client claims. */
export const UNBOUND_SCHEME = 'unbound';

const DISCORD_RELAY_PREFIX = 'com.hammerandchisel.discord://unbound/';
const LINK_PREFIXES = [`${UNBOUND_SCHEME}://`, DISCORD_RELAY_PREFIX];

/** Something a page asks the client to do. */
export type UnboundLink = { action: 'install'; id: string };

function readQuery(query: string): Map<string, string> | undefined {
	const params = new Map<string, string>();

	for (const pair of query.split('&')) {
		if (!pair) {
			continue;
		}

		const separator = pair.indexOf('=');
		const key = separator === -1 ? pair : pair.slice(0, separator);
		const value = separator === -1 ? '' : pair.slice(separator + 1);

		try {
			params.set(decodeURIComponent(key), decodeURIComponent(value));
		} catch {
			return undefined;
		}
	}

	return params;
}

/**
 * @description Builds the link a page navigates to so the client installs an addon.
 * @param link What the client should do.
 * @returns The `unbound://` URL, e.g. `unbound://install?id=acme.hello`.
 */
export function createUnboundLink(link: UnboundLink): string {
	return `${UNBOUND_SCHEME}://${link.action}?id=${encodeURIComponent(link.id)}`;
}

/**
 * @description Parses an incoming URL into a link. Reads the string by hand, since Hermes' URL lacks `searchParams`.
 * @param url Any URL the app received, Discord's own included. Unknown query parameters are ignored.
 * @returns The link, or `undefined` when the URL is not a well-formed Unbound link.
 */
export function parseUnboundLink(url: string): UnboundLink | undefined {
	const lower = url.toLowerCase();
	const prefix = LINK_PREFIXES.find((candidate) => lower.startsWith(candidate));

	if (!prefix) {
		return undefined;
	}

	const rest = url.slice(prefix.length).split('#')[0] ?? '';
	const separator = rest.indexOf('?');
	const action = separator === -1 ? rest : rest.slice(0, separator);
	const params = readQuery(separator === -1 ? '' : rest.slice(separator + 1));

	if (action !== 'install' || !params) {
		return undefined;
	}

	const id = addonIdSchema.safeParse(params.get('id'));

	return id.success ? { action, id: id.data } : undefined;
}

export default { UNBOUND_SCHEME, createUnboundLink, parseUnboundLink };
