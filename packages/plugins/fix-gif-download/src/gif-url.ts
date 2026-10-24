import { getDiscordProxyTarget, isDiscordExternalProxy } from '~/discord-proxy';
import { NESTED_KEYS, SOURCE_KEYS } from '~/constants';
import { isRecord } from '~/media-record';

function isGifProvider(value: string): boolean {
	return /(?:klipy|tenor|giphy)/i.test(value);
}

function isGifContentType(value: unknown): boolean {
	return typeof value === 'string' && value.toLowerCase().startsWith('image/gif');
}

function hasGifExtension(value: string): boolean {
	try {
		const url = new URL(value);

		return (
			url.pathname.toLowerCase().endsWith('.gif') ||
			url.searchParams.get('format')?.toLowerCase() === 'gif'
		);
	} catch {
		return /(?:^|[/?_.-])gif(?:$|[/?_.-])/i.test(value);
	}
}

function isGifProviderVideo(value: string): boolean {
	try {
		const url = new URL(value);
		const pathname = url.pathname.toLowerCase();
		const format = url.searchParams.get('format')?.toLowerCase();

		return (
			isGifProvider(`${url.hostname}${pathname}${url.search}`) &&
			(/\.(?:mp4|webm|webp)$/.test(pathname) ||
				format === 'mp4' ||
				format === 'video' ||
				format === 'webp')
		);
	} catch {
		return isGifProvider(value) && /\.(?:mp4|webm|webp)(?:$|[?#])/i.test(value);
	}
}

function canonicalGiphyUrl(url: URL): string {
	const id =
		url.pathname.match(/\/media\/([^/]+)/i)?.[1] ??
		url.pathname.match(/\/gifs\/[^/]*?([a-z0-9]{6,})$/i)?.[1];

	return id ? `https://media.giphy.com/media/${id}/giphy.gif` : url.toString();
}

// The URL of the GIF itself when `value` already names one, or names one in a form Discord, Giphy or Tenor can serve as GIF.
function directGifUrl(value: string): string | null {
	try {
		const url = new URL(value);
		const pathname = url.pathname.toLowerCase();

		if (isDiscordExternalProxy(value)) {
			const target = getDiscordProxyTarget(value);

			if (target) return directGifUrl(target);

			return pathname.endsWith('.gif') ? url.toString() : null;
		}

		if (pathname.endsWith('.gif')) {
			const format = url.searchParams.get('format')?.toLowerCase();

			if (format && format !== 'gif') url.searchParams.set('format', 'gif');

			return url.toString();
		}

		if (url.searchParams.get('animated') === 'true' && /\.(?:webp|avif|mp4)$/.test(pathname)) {
			url.pathname = url.pathname.replace(/\.(?:webp|avif|mp4)$/i, '.gif');
			url.searchParams.set('format', 'gif');

			return url.toString();
		}

		const host = url.hostname.toLowerCase();

		if (host.includes('giphy.com') && /\/gifs?\//i.test(url.pathname)) {
			const canonical = canonicalGiphyUrl(url);

			if (canonical !== url.toString()) return canonical;
		}

		if (host === 'tenor.com') {
			url.pathname = `${url.pathname}.gif`;

			return url.toString();
		}
	} catch {
		// Not a URL.
	}

	return null;
}

// Like `directGifUrl`, but also derives the GIF URL from a GIF provider's video rendition.
function asGifUrl(value: string): string | null {
	if (isDiscordExternalProxy(value)) {
		const target = getDiscordProxyTarget(value);

		if (target) return asGifUrl(target);

		return hasGifExtension(value) ? value : null;
	}

	const direct = directGifUrl(value);

	if (direct) return direct;

	if (!isGifProviderVideo(value)) return null;

	try {
		const url = new URL(value);
		const host = url.hostname.toLowerCase();

		if (host.includes('giphy.com')) return canonicalGiphyUrl(url);

		// Klipy's video and GIF paths differ, so its GIF is resolved through the Klipy API instead.
		if (host.includes('klipy.com')) return null;

		if (url.searchParams.has('format')) url.searchParams.set('format', 'gif');

		url.pathname = url.pathname.replace(/\.(?:mp4|webm|webp)$/i, '.gif');

		return url.toString();
	} catch {
		return value.replace(/\.(?:mp4|webm)(?=$|[?#])/i, '.gif');
	}
}

/**
 * @description Finds the best GIF URL for a media source, preferring a URL that already points at a GIF over one derived from a video.
 * @param value A URL, or a Discord media record holding one.
 * @param depth How deep into nested media records the search already is.
 * @returns The GIF URL, or `null` when none can be derived without a network request.
 */
export function getPreferredGifUrl(value: unknown, depth: number = 0): string | null {
	if (depth > 3) return null;

	if (typeof value === 'string') return asGifUrl(value);

	if (!isRecord(value)) return null;

	let derived: string | null = null;

	for (const key of SOURCE_KEYS) {
		const candidate = value[key];

		if (typeof candidate !== 'string') {
			continue;
		}

		const direct = directGifUrl(candidate);

		if (direct) return direct;

		derived ??= asGifUrl(candidate);
	}

	if (derived) return derived;

	for (const key of NESTED_KEYS) {
		const nested = getPreferredGifUrl(value[key], depth + 1);

		if (nested) return nested;
	}

	return null;
}

/**
 * @description Checks whether a media source is a GIF, including GIFs Discord serves as video.
 * @param value A URL, or a Discord media record holding one.
 * @param contentType The content type Discord reported for the source.
 * @param depth How deep into nested media records the search already is.
 * @returns `true` when the source or its content type marks a GIF or a GIF provider's video.
 */
export function isGifSource(value: unknown, contentType?: unknown, depth: number = 0): boolean {
	if (depth > 3) return false;

	if (isGifContentType(contentType)) return true;

	if (typeof value === 'string') return hasGifExtension(value) || isGifProviderVideo(value);

	if (!isRecord(value)) return false;

	if (typeof value.providerName === 'string' && isGifProvider(value.providerName)) return true;

	if (isGifContentType(value.contentType ?? value.mimeType ?? value.type)) return true;

	return [...SOURCE_KEYS, ...NESTED_KEYS].some((key) =>
		isGifSource(value[key], undefined, depth + 1),
	);
}
