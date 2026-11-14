const DISCORD_IMAGE =
	/^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net|images-ext-[12]\.discordapp\.net)(\/[^?#]*)(\?[^#]*)?/;
const FORMAT = /(^|&)format=[^&]*/;

function withFormat(query: string | undefined): string {
	const params = (query ?? '').replace(/^\?/, '');

	if (FORMAT.test(params)) return `?${params.replace(FORMAT, '$1format=png')}`;

	return params ? `?${params}&format=png` : '?format=png';
}

/**
 * @description Asks Discord's media proxy for an image as PNG, so the clipboard gets a format every app pastes. Images
 * outside Discord's hosts are left as they are. Works on the text, since React Native's `URL` cannot change a URL.
 * @param url The image the media viewer shows.
 * @returns The URL to download.
 */
export function pngUrl(url: string): string {
	const match = DISCORD_IMAGE.exec(url);

	if (!match) return url;

	const host = match[1] === 'cdn.discordapp.com' ? 'media.discordapp.net' : match[1];

	return `https://${host}${match[2]}${withFormat(match[3])}`;
}

export default pngUrl;
