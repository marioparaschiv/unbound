const CDN = /^https:\/\/cdn\.discordapp\.com\//;

/** What the media viewer's share menu knows about the item it shows. */
export type ShareSource = { uri?: string; sourceURI?: string; videoURI?: string };

/**
 * @description Picks the picture to read: the full-size source, never a video, through Discord's media proxy, since
 * iOS cannot load attachment links from the CDN without Discord's own session.
 * @param source The media viewer's item.
 * @returns The image URL, or `undefined` for a video or an item without one.
 */
export function readableImage(source: ShareSource | undefined): string | undefined {
	if (!source || source.videoURI) return undefined;

	const url = source.sourceURI ?? source.uri;

	return url?.startsWith('https://')
		? url.replace(CDN, 'https://media.discordapp.net/')
		: undefined;
}
