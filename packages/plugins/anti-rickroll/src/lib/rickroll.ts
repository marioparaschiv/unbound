export type Fetcher = (
	url: string,
	init?: { method?: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; url: string; json(): Promise<unknown> }>;

const KNOWN_VIDEOS = new Set(['dQw4w9WgXcQ', 'oHg5SJYRHA0', 'xvFZjo5PgG0', 'iik25wqIuFo']);
const SHORTENERS = new Set([
	'bit.ly',
	'tinyurl.com',
	't.co',
	'goo.gl',
	'is.gd',
	'v.gd',
	'cutt.ly',
	'rb.gy',
	'shorturl.at',
	'tiny.cc',
	'ow.ly',
	'buff.ly',
	'rebrand.ly',
	's.id',
	't.ly',
	'shorturl.gg',
]);
const YOUTUBE_HOSTS = /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/;
const RICKROLL_TITLE = /never gonna give you up|rick ?roll/i;
const TIMEOUT_MS = 2500;

function parse(url: string): URL | undefined {
	try {
		return new URL(url);
	} catch {
		return undefined;
	}
}

/**
 * @description Reads a YouTube video id from its watch, short, embed or youtu.be link.
 * @param url The link.
 * @returns The id, or `undefined` for a link to anything else.
 */
export function youtubeId(url: string): string | undefined {
	const parsed = parse(url);

	if (!parsed || !YOUTUBE_HOSTS.test(parsed.hostname)) return undefined;

	if (parsed.hostname.endsWith('youtu.be')) return parsed.pathname.split('/')[1] || undefined;

	return (
		parsed.searchParams.get('v') ??
		/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/.exec(parsed.pathname)?.[1] ??
		undefined
	);
}

/**
 * @description Whether a link needs checking before it opens: a YouTube video, a short link or a site named after the prank.
 * @param url The link.
 * @returns Whether to check it.
 */
export function needsCheck(url: string): boolean {
	const parsed = parse(url);

	return Boolean(
		parsed &&
		(SHORTENERS.has(parsed.hostname.replace(/^www\./, '')) ||
			YOUTUBE_HOSTS.test(parsed.hostname) ||
			parsed.hostname.includes('rickroll')),
	);
}

function timeout(): AbortSignal {
	const controller = new AbortController();

	setTimeout(() => controller.abort(), TIMEOUT_MS);

	return controller.signal;
}

async function rickrollVideo(id: string, fetcher: Fetcher): Promise<boolean> {
	if (KNOWN_VIDEOS.has(id)) return true;

	const response = await fetcher(
		`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://youtu.be/${id}`)}`,
		{ signal: timeout() },
	);

	if (!response.ok) return false;

	const body = (await response.json()) as { title?: unknown; author_name?: unknown };
	const title = typeof body.title === 'string' ? body.title : '';
	const author = typeof body.author_name === 'string' ? body.author_name : '';

	return (
		RICKROLL_TITLE.test(title) || (/rick astley/i.test(author) && /give you up/i.test(title))
	);
}

/**
 * @description Decides whether a link is a Rickroll: a known video, a video titled like one, a site named after it, or
 * a short link that redirects to any of those. Fails open: a link that can't be checked in time is let through.
 * @param url The link.
 * @param fetcher How to fetch, following redirects.
 * @returns Whether to warn before opening it.
 */
export async function isRickroll(url: string, fetcher: Fetcher): Promise<boolean> {
	const parsed = parse(url);

	if (!parsed) return false;

	if (parsed.hostname.includes('rickroll')) return true;

	try {
		const id = youtubeId(url);

		if (id) return await rickrollVideo(id, fetcher);

		if (SHORTENERS.has(parsed.hostname.replace(/^www\./, ''))) {
			const response = await fetcher(url, { method: 'HEAD', signal: timeout() });

			return response.url !== url && (await isRickroll(response.url, fetcher));
		}
	} catch {
		return false;
	}

	return false;
}
