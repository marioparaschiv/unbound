import { KLIPY_API_KEY, NESTED_KEYS, SOURCE_KEYS } from '~/constants';
import { getDiscordProxyTarget } from '~/discord-proxy';
import { findDeep, isRecord } from '~/media-record';

const resolved = new Map<string, string>();
const requests = new Map<string, Promise<string | null>>();

// Klipy media URLs carry the GIF's hash as `/ii/<hash>/`, also when wrapped in a Discord proxy URL.
function mediaHash(value: string): string | null {
	try {
		const url = new URL(getDiscordProxyTarget(value) ?? value);

		return url.pathname.match(/\/ii\/([^/]+)\//i)?.[1] ?? null;
	} catch {
		return null;
	}
}

function pageSlug(value: unknown): string | null {
	if (typeof value !== 'string') return null;

	try {
		const url = new URL(value);

		if (!url.hostname.toLowerCase().endsWith('klipy.com')) return null;

		const slug = url.pathname.match(/^\/gifs\/([^/?#]+)/i)?.[1];

		return slug ? decodeURIComponent(slug) : null;
	} catch {
		return null;
	}
}

function title(value: unknown): string | null {
	if (!isRecord(value)) return null;

	for (const key of ['title', 'description', 'slug']) {
		const candidate = value[key];

		if (typeof candidate === 'string' && candidate) return candidate;
	}

	return null;
}

function klipyHash(value: unknown): string | null {
	return typeof value === 'string' && /klipy/i.test(value) ? mediaHash(value) : null;
}

function klipyGifUrl(value: unknown): string | null {
	return typeof value === 'string' && /\.gif(?:$|[?#])/i.test(value) && /klipy/i.test(value)
		? value
		: null;
}

function findGifUrl(value: unknown): string | null {
	return findDeep(value, klipyGifUrl, 7, [
		'gif',
		'url',
		'sourceURI',
		'sourceUri',
		'sourceUrl',
		'originalUrl',
		'mediaUrl',
	]);
}

// The first GIF URL in a Klipy search result whose hash matches, or any GIF URL when the hash is unknown.
function findMatchingGif(result: unknown, hash: string | null): string | null {
	return findDeep(
		result,
		(value) => {
			if (!isRecord(value)) return null;

			const url = findGifUrl(value);

			return url && (!hash || mediaHash(url) === hash) ? url : null;
		},
		7,
	);
}

async function search(slug: string, hash: string | null): Promise<string | null> {
	try {
		const query = encodeURIComponent(slug.replace(/[-_]+/g, ' '));
		const response = await fetch(
			`https://api.klipy.com/api/v1/${KLIPY_API_KEY}/gifs/search?per_page=30&q=${query}&page=1&customer_id=unbound`,
		);

		if (!response.ok) return null;

		const payload: unknown = await response.json();
		const results = isRecord(payload) && isRecord(payload.data) ? payload.data.data : null;

		if (!Array.isArray(results)) return null;

		for (const result of results) {
			const match = findMatchingGif(result, hash);

			if (match) return match;
		}
	} catch {
		// Network or parse failure; the download falls back to Discord's own media.
	}

	return null;
}

/**
 * @description Finds the GIF rendition of Klipy media, which Discord only keeps as video, by searching Klipy for its slug or title.
 * @param value A Discord media record or URL for the Klipy media.
 * @returns The GIF URL, or `null` when the media is not Klipy's or no search result matches.
 */
export async function resolveKlipyGifUrl(value: unknown): Promise<string | null> {
	const hash = findDeep(value, klipyHash, 5, [...SOURCE_KEYS, ...NESTED_KEYS]);
	const slug =
		findDeep(value, pageSlug, 5, [
			'url',
			'uri',
			'sourceURI',
			'sourceUri',
			'sourceUrl',
			'embed',
			'original',
			'source',
			'media',
		]) ??
		findDeep(value, title, 5, [
			'media',
			'source',
			'original',
			'attachment',
			'gif',
			'result',
			'data',
			'embed',
		]);
	const key = hash ?? slug;

	if (!key) return null;

	const cached = resolved.get(key) ?? requests.get(key);

	if (cached) return cached;

	if (!slug) return null;

	const request = search(slug, hash);

	requests.set(key, request);

	try {
		const url = await request;

		if (url) resolved.set(key, url);

		return url;
	} finally {
		requests.delete(key);
	}
}
