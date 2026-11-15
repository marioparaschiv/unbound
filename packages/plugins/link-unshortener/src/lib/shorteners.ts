const SHORTENERS = new Set([
	'bit.ly',
	'bitly.com',
	't.co',
	'tinyurl.com',
	'goo.gl',
	'ow.ly',
	'is.gd',
	'v.gd',
	'buff.ly',
	'rebrand.ly',
	'cutt.ly',
	'shorturl.at',
	'rb.gy',
	't.ly',
	'tiny.cc',
	'lnkd.in',
	'dlvr.it',
	's.id',
	'shorte.st',
	'adf.ly',
	'trib.al',
	'amzn.to',
	'a.co',
	'spoti.fi',
	'qr.ae',
	'clck.ru',
	'surl.li',
]);
const MAX_REDIRECTS = 10;

/**
 * @description Tells whether a link goes through a known link shortener.
 * @param link The link.
 * @returns Whether its host is a shortener.
 */
export function isShortLink(link: string): boolean {
	const host = /^https?:\/\/([^/?#:]+)/i
		.exec(link)?.[1]
		?.toLowerCase()
		.replace(/^www\./, '');

	return host !== undefined && SHORTENERS.has(host);
}

export type Resolved = { url: string; redirects: number };

type Fetch = (
	url: string,
	init: { method: string; redirect: 'manual' },
) => Promise<{ status: number; url?: string; headers: { get(name: string): string | null } }>;

/**
 * @description Follows a link's redirects one at a time without loading the pages, up to ten. Where the platform follows
 * redirects itself, as React Native does on Android, the response's final address counts as one.
 * @param link The link.
 * @param request The fetch to use.
 * @returns The final address and the number of redirects.
 */
export async function resolveLink(
	link: string,
	request: Fetch = fetch as unknown as Fetch,
): Promise<Resolved> {
	let url = link;
	let redirects = 0;

	for (; redirects < MAX_REDIRECTS; redirects++) {
		const response = await request(url, { method: 'HEAD', redirect: 'manual' });
		const location =
			response.status >= 300 && response.status < 400
				? response.headers.get('location')
				: null;

		if (!location) {
			if (response.url && response.url !== url) {
				url = response.url;
				redirects++;
			}

			break;
		}

		url = new URL(location, url).toString();
	}

	return { url, redirects };
}
