import { createLogger } from '@unbound-app/logger';

const logger = createLogger('Plugins', 'Network');

type Send = (...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>;

/** A plugin's `fetch`, which keeps to the hosts its manifest lists. */
export type ScopedFetch = {
	fetch: typeof fetch;
	/** The hosts this plugin tried to reach that its manifest does not list. */
	blocked: () => string[];
};

/**
 * @description Tells whether a host matches one of a manifest's network entries: an exact host, or `*.example.com`
 * for that domain and its subdomains.
 * @param host The host a request goes to, lowercased.
 * @param allowed The manifest's network entries.
 * @returns Whether the request may go out.
 */
export function hostAllowed(host: string, allowed: readonly string[]): boolean {
	return allowed.some((entry) => {
		if (!entry.startsWith('*.')) {
			return host === entry;
		}

		const domain = entry.slice(2);

		return host === domain || host.endsWith(`.${domain}`);
	});
}

function hostOf(input: Parameters<typeof fetch>[0]): string | undefined {
	const url = typeof input === 'string' ? input : 'url' in input ? input.url : String(input);

	try {
		return new URL(url).hostname.toLowerCase();
	} catch {
		// A relative or malformed URL has no host to check; fetch itself rejects it.
		return undefined;
	}
}

/**
 * @description Creates the `fetch` one plugin runs with. A plugin whose manifest lists `network` hosts can only reach
 * those; a request to any other host is refused and logged once per host. Without a list, requests pass through.
 * @param name The plugin's name, for the log.
 * @param allowed The manifest's `network` entries, or `undefined` for any host.
 * @param send Sends an allowed request; the global `fetch` as it is at call time.
 * @returns The scoped `fetch` and the hosts it refused.
 */
export function createScopedFetch(
	name: string,
	allowed: readonly string[] | undefined,
	send: Send = (...args) => globalThis.fetch(...args),
): ScopedFetch {
	const refused = new Set<string>();

	function scopedFetch(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
		const host = allowed ? hostOf(args[0]) : undefined;

		if (!allowed || host === undefined || hostAllowed(host, allowed)) {
			return send(...args);
		}

		if (!refused.has(host)) {
			refused.add(host);
			logger.warn(
				`Blocked ${name} from reaching ${host}: its manifest's network list leaves it out.`,
			);
		}

		return Promise.reject(new TypeError(`${name} may not reach ${host}.`));
	}

	return { fetch: scopedFetch as typeof fetch, blocked: () => [...refused] };
}

export default createScopedFetch;
