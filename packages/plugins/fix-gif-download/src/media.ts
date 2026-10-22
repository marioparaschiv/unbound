type MediaRecord = Record<string, unknown>;

const KLIPY_API_KEY = '685pfsUU3EODe5rjG3li8rLUdfyydxxfh8fPym7wM5dvr0jklulSi6g5BSWlL3zG';
const klipyGifCache = new Map<string, string>();
const klipyGifRequests = new Map<string, Promise<string | null>>();

function isRecord(value: unknown): value is MediaRecord {
	return !!value && typeof value === 'object';
}

function isGifProvider(value: string): boolean {
	return /(?:klipy|tenor|giphy)/i.test(value);
}

function isDiscordExternalProxy(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			/^(?:images-ext-\d+|media)\.discordapp\.net$/i.test(url.hostname) &&
			/\/external\//i.test(url.pathname)
		);
	} catch {
		return false;
	}
}

function getDiscordProxyTarget(value: string): string | null {
	if (!isDiscordExternalProxy(value)) return null;
	try {
		const path = decodeURIComponent(new URL(value).pathname);
		const targetIndex = path.indexOf('/https/');
		if (targetIndex < 0) return null;
		const prefix = path.slice('/external/'.length, targetIndex);
		const target = `https://${path.slice(targetIndex + '/https/'.length)}`;
		return prefix.startsWith('?') ? `${target}${prefix}` : target;
	} catch {
		return null;
	}
}

function klipyMediaHash(value: string): string | null {
	const target = getDiscordProxyTarget(value) ?? value;
	try {
		const match = new URL(target).pathname.match(/\/ii\/([^/]+)\//i);
		return match?.[1] ?? null;
	} catch {
		return null;
	}
}

function klipyPageSlug(value: string): string | null {
	try {
		const url = new URL(value);
		if (!url.hostname.toLowerCase().endsWith('klipy.com')) return null;
		const match = url.pathname.match(/^\/gifs\/([^/?#]+)/i);
		return match?.[1] ? decodeURIComponent(match[1]) : null;
	} catch {
		return null;
	}
}

function findKlipyPageSlug(value: unknown, depth = 0): string | null {
	if (depth > 5) return null;
	if (typeof value === 'string') return klipyPageSlug(value);
	if (!isRecord(value)) return null;
	for (const key of [
		'url',
		'uri',
		'sourceURI',
		'sourceUri',
		'sourceUrl',
		'embed',
		'original',
		'source',
		'media',
	]) {
		const slug = findKlipyPageSlug(value[key], depth + 1);
		if (slug) return slug;
	}
	for (const key of Object.keys(value)) {
		const slug = findKlipyPageSlug(value[key], depth + 1);
		if (slug) return slug;
	}
	return null;
}

function findKlipyHash(value: unknown, depth = 0): string | null {
	if (depth > 5) return null;
	if (typeof value === 'string') {
		if (!/klipy/i.test(value)) return null;
		return klipyMediaHash(value);
	}
	if (!isRecord(value)) return null;
	for (const key of sourceKeys) {
		const hash = findKlipyHash(value[key], depth + 1);
		if (hash) return hash;
	}
	for (const key of [
		'media',
		'source',
		'original',
		'attachment',
		'gif',
		'result',
		'data',
		'image',
		'thumbnail',
		'video',
		'embed',
	]) {
		const hash = findKlipyHash(value[key], depth + 1);
		if (hash) return hash;
	}
	for (const key of Object.keys(value)) {
		const hash = findKlipyHash(value[key], depth + 1);
		if (hash) return hash;
	}
	return null;
}

function findKlipyTitle(value: unknown, depth = 0): string | null {
	if (depth > 5 || !isRecord(value)) return null;
	for (const key of ['title', 'description', 'slug']) {
		if (typeof value[key] === 'string' && value[key]) return value[key] as string;
	}
	for (const key of [
		'media',
		'source',
		'original',
		'attachment',
		'gif',
		'result',
		'data',
		'embed',
	]) {
		const title = findKlipyTitle(value[key], depth + 1);
		if (title) return title;
	}
	for (const key of Object.keys(value)) {
		const title = findKlipyTitle(value[key], depth + 1);
		if (title) return title;
	}
	return null;
}

function findGifUrl(value: unknown, depth = 0): string | null {
	if (depth > 7) return null;
	if (typeof value === 'string')
		return /\.gif(?:$|[?#])/i.test(value) && /klipy/i.test(value) ? value : null;
	if (!isRecord(value)) return null;
	for (const key of [
		'gif',
		'url',
		'sourceURI',
		'sourceUri',
		'sourceUrl',
		'originalUrl',
		'mediaUrl',
	]) {
		const url = findGifUrl(value[key], depth + 1);
		if (url) return url;
	}
	for (const key of Object.keys(value)) {
		const url = findGifUrl(value[key], depth + 1);
		if (url) return url;
	}
	return null;
}

function findMatchingKlipyGif(value: unknown, hash: string | null, depth = 0): string | null {
	if (depth > 7) return null;
	if (!isRecord(value)) return null;
	const gifUrl = findGifUrl(value);
	if (gifUrl && (!hash || klipyMediaHash(gifUrl) === hash)) return gifUrl;
	for (const key of Object.keys(value)) {
		const match = findMatchingKlipyGif(value[key], hash, depth + 1);
		if (match) return match;
	}
	return null;
}

export async function resolveKlipyGifUrl(value: unknown): Promise<string | null> {
	const hash = findKlipyHash(value);
	const slug = findKlipyPageSlug(value) ?? findKlipyTitle(value);
	const cacheKey = hash ?? slug;
	if (!cacheKey) return null;
	const cached = klipyGifCache.get(cacheKey);
	if (cached) return cached;
	const existing = klipyGifRequests.get(cacheKey);
	if (existing) return existing;
	const request = (async () => {
		if (!slug) return null;
		try {
			const query = encodeURIComponent(slug.replace(/[-_]+/g, ' '));
			const response = await fetch(
				`https://api.klipy.com/api/v1/${KLIPY_API_KEY}/gifs/search?per_page=30&q=${query}&page=1&customer_id=unbound`,
			);
			if (!response.ok) return null;
			const payload = (await response.json()) as Record<string, unknown>;
			const data = isRecord(payload.data) ? payload.data.data : null;
			if (!Array.isArray(data)) return null;
			for (const item of data) {
				const match = findMatchingKlipyGif(item, hash);
				if (match) {
					klipyGifCache.set(cacheKey, match);
					if (hash) klipyGifCache.set(hash, match);
					return match;
				}
			}
		} catch {}
		return null;
	})();
	klipyGifRequests.set(cacheKey, request);
	try {
		return await request;
	} finally {
		klipyGifRequests.delete(cacheKey);
	}
}

export function hasGifExtension(value: string): boolean {
	try {
		const url = new URL(value);
		const pathname = url.pathname.toLowerCase();
		const format = url.searchParams.get('format')?.toLowerCase();
		return pathname.endsWith('.gif') || format === 'gif';
	} catch {
		return /(?:^|[/?_.-])gif(?:$|[/?_.-])/i.test(value);
	}
}

function likelyGifVideo(value: string): boolean {
	try {
		const url = new URL(value);
		const host = url.hostname.toLowerCase();
		const pathname = url.pathname.toLowerCase();
		const format = url.searchParams.get('format')?.toLowerCase();
		return (
			isGifProvider(`${host}${pathname}${url.search}`) &&
			(pathname.endsWith('.mp4') ||
				pathname.endsWith('.webm') ||
				pathname.endsWith('.webp') ||
				format === 'mp4' ||
				format === 'video' ||
				format === 'webp')
		);
	} catch {
		return isGifProvider(value) && /\.(?:mp4|webm|webp)(?:$|[?#])/i.test(value);
	}
}

function canonicalGiphyUrl(url: URL): string {
	const mediaMatch = url.pathname.match(/\/media\/([^/]+)/i);
	if (mediaMatch) return `https://media.giphy.com/media/${mediaMatch[1]}/giphy.gif`;

	const pageMatch = url.pathname.match(/\/gifs\/[^/]*?([a-z0-9]{6,})$/i);
	if (pageMatch) return `https://media.giphy.com/media/${pageMatch[1]}/giphy.gif`;
	return url.toString();
}

function directGifUrl(value: string): string | null {
	try {
		const parsed = new URL(value);
		const pathname = parsed.pathname.toLowerCase();
		const format = parsed.searchParams.get('format')?.toLowerCase();
		if (isDiscordExternalProxy(value)) {
			const target = getDiscordProxyTarget(value);
			return target
				? directGifUrl(target)
				: pathname.endsWith('.gif')
					? parsed.toString()
					: null;
		}
		if (pathname.endsWith('.gif')) {
			if (format && format !== 'gif') parsed.searchParams.set('format', 'gif');
			return parsed.toString();
		}
		if (
			parsed.searchParams.get('animated') === 'true' &&
			(pathname.endsWith('.webp') || pathname.endsWith('.avif') || pathname.endsWith('.mp4'))
		) {
			parsed.pathname = parsed.pathname.replace(/\.(?:webp|avif|mp4)$/i, '.gif');
			parsed.searchParams.set('format', 'gif');
			return parsed.toString();
		}
		if (
			parsed.hostname.toLowerCase().includes('giphy.com') &&
			/\/gifs?\//i.test(parsed.pathname)
		) {
			const normalized = canonicalGiphyUrl(parsed);
			if (normalized !== parsed.toString()) return normalized;
		}
		if (
			parsed.hostname.toLowerCase() === 'tenor.com' &&
			!parsed.pathname.toLowerCase().endsWith('.gif')
		) {
			parsed.pathname = `${parsed.pathname}.gif`;
			return parsed.toString();
		}
	} catch {}
	return null;
}

function asGifUrl(value: string): string | null {
	if (isDiscordExternalProxy(value)) {
		const target = getDiscordProxyTarget(value);
		if (target) return asGifUrl(target);
		return hasGifExtension(value) ? value : null;
	}
	const direct = directGifUrl(value);
	if (direct) return direct;
	if (!likelyGifVideo(value)) return null;

	try {
		const url = new URL(value);
		if (url.hostname.toLowerCase().includes('giphy.com')) return canonicalGiphyUrl(url);
		if (url.hostname.toLowerCase().includes('klipy.com')) return null;
		if (url.searchParams.has('format')) url.searchParams.set('format', 'gif');
		url.pathname = url.pathname.replace(/\.(?:mp4|webm)$/i, '.gif');
		url.pathname = url.pathname.replace(/\.webp$/i, '.gif');
		return url.toString();
	} catch {
		return value.replace(/\.(?:mp4|webm)(?=$|[?#])/i, '.gif');
	}
}

const sourceKeys = [
	'sourceURI',
	'sourceUri',
	'sourceUrl',
	'originalURI',
	'originalUri',
	'originalUrl',
	'proxyUrl',
	'proxyURL',
	'mediaUrl',
	'mediaURL',
	'videoURI',
	'videoUrl',
	'imageUrl',
	'src',
	'source',
	'thumbnail',
	'uri',
	'url',
];

export function getPreferredGifUrl(value: unknown, depth = 0): string | null {
	if (depth > 3) return null;
	if (typeof value === 'string') return asGifUrl(value);
	if (!isRecord(value)) return null;

	let fallback: string | null = null;
	for (const key of sourceKeys) {
		const candidate = value[key];
		if (typeof candidate !== 'string') continue;
		const direct = directGifUrl(candidate);
		if (direct) return direct;
		const gifUrl = asGifUrl(candidate);
		if (gifUrl && !fallback) fallback = gifUrl;
	}
	if (fallback) return fallback;

	let nestedFallback: string | null = null;
	for (const key of [
		'media',
		'source',
		'original',
		'attachment',
		'gif',
		'result',
		'data',
		'image',
		'thumbnail',
		'video',
		'embed',
	]) {
		const nested = getPreferredGifUrl(value[key], depth + 1);
		if (nested && !nestedFallback) nestedFallback = nested;
	}

	return nestedFallback;
}

export function isGifSource(value: unknown, contentType?: unknown, depth = 0): boolean {
	if (depth > 3) return false;
	if (typeof contentType === 'string' && contentType.toLowerCase().startsWith('image/gif'))
		return true;
	if (typeof value === 'string') return hasGifExtension(value) || likelyGifVideo(value);
	if (!isRecord(value)) return false;
	if (typeof value.providerName === 'string' && isGifProvider(value.providerName)) return true;

	const nestedType = value.contentType ?? value.mimeType ?? value.type;
	if (typeof nestedType === 'string' && nestedType.toLowerCase().startsWith('image/gif'))
		return true;
	return (
		sourceKeys.some((key) => isGifSource(value[key], undefined, depth + 1)) ||
		[
			'media',
			'source',
			'original',
			'attachment',
			'gif',
			'result',
			'data',
			'image',
			'thumbnail',
			'video',
			'embed',
		].some((key) => isGifSource(value[key], undefined, depth + 1))
	);
}

export function rewriteGifMedia(
	value: unknown,
	contentType?: unknown,
): { source: unknown; contentType: unknown } | null {
	const gifUrl = getPreferredGifUrl(value);
	if (!gifUrl && !isGifSource(value, contentType)) return null;
	if (isRecord(value) && gifUrl) {
		return {
			source: {
				...value,
				sourceURI: gifUrl,
				contentType: 'image/gif',
			},
			contentType: 'image/gif',
		};
	}
	return {
		source: gifUrl ?? value,
		contentType: 'image/gif',
	};
}
