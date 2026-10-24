/**
 * @description Rewrites a Discord CDN image URL to request a given size, as a GIF when animated and WebP otherwise.
 * @param source The CDN URL, which may be relative to discord.com, or a data URI.
 * @param size The pixel size to request.
 * @returns The rewritten URL; a data URI is returned unchanged.
 */
export function normalizeImageUrl(source: string, size: number): string {
	if (source.startsWith('data:')) return source;

	const url = new URL(source, 'https://discord.com');
	const animated =
		url.searchParams.get('animated') === 'true' ||
		/\/a_[^/]+\.(?:png|jpe?g|webp|gif)$/i.test(url.pathname);

	url.searchParams.set('size', String(size));
	url.pathname = url.pathname.replace(/\.(?:png|jpe?g|webp|gif)$/i, animated ? '.gif' : '.webp');

	return url.toString();
}

export default normalizeImageUrl;
