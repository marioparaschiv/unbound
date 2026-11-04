import { DISCORD_HOST, VIDEO_EXTENSION } from '~/constants';
import type { MediaSource } from '~/types';

function parse(uri: unknown): URL | undefined {
	if (typeof uri !== 'string' || !uri) return;

	try {
		return new URL(uri);
	} catch {
		return;
	}
}

/**
 * @description Turns a media address into a key that is the same for Discord's CDN and media proxy copies of one file.
 * @param uri The address, as the media viewer or the player holds it.
 * @returns The path for a Discord host, the host and path for any other host, or `undefined` for something that is not an address.
 */
export function mediaKey(uri: unknown): string | undefined {
	const url = parse(uri);

	if (!url) return typeof uri === 'string' && uri ? uri : undefined;

	const host = url.hostname.toLowerCase();

	return DISCORD_HOST.test(host) ? url.pathname : `${host}${url.pathname}`;
}

/**
 * @description Collects the keys of every address a media viewer source carries.
 * @param source The media viewer source.
 * @returns The distinct keys, in the order the video address, the shown address, the original and the embed come.
 */
export function sourceKeys(source: MediaSource | undefined): string[] {
	const keys = [source?.videoURI, source?.uri, source?.sourceURI, source?.embedURI]
		.map(mediaKey)
		.filter((key): key is string => key !== undefined);

	return [...new Set(keys)];
}

/**
 * @description Tells whether a media viewer source is a video.
 * @param source The media viewer source.
 * @returns `true` for a source with a video address, a GIF video, or an address that ends in a video file extension.
 */
export function isVideoSource(source: MediaSource | undefined): boolean {
	if (!source) return false;
	if (typeof source.videoURI === 'string' && source.videoURI) return true;
	if (source.isGIFV === true) return true;

	return [source.uri, source.sourceURI].some((uri) => {
		const url = parse(uri);

		return url ? VIDEO_EXTENSION.test(url.pathname) : false;
	});
}

export type PlayerKind = 'video' | 'web';

/**
 * @description Tells how the media viewer plays a source: a native video player, or a web player in a `WebView` for embeds such as YouTube.
 * @param source The media viewer source.
 * @returns `video` for a video, `web` for an embed the viewer loads as a page, or `undefined` for anything else.
 */
export function playerKind(source: MediaSource | undefined): PlayerKind | undefined {
	if (isVideoSource(source)) return 'video';

	const embed = parse(source?.embedURI);

	return embed && (embed.protocol === 'https:' || embed.protocol === 'http:') ? 'web' : undefined;
}

/**
 * @description Names the video a media viewer source shows, so the header's button and the session agree on which video is in the window.
 * @param source The media viewer source.
 * @returns The key of the video's first address, or `undefined` when the source is not a video.
 */
export function videoKey(source: MediaSource | undefined): string | undefined {
	return playerKind(source) ? sourceKeys(source)[0] : undefined;
}
