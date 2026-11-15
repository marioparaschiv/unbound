/** What the media viewer's share menu knows about the item it shows. */
export type ShareSource = {
	uri?: string;
	sourceURI?: string;
	videoURI?: string;
};

/**
 * @description Picks the picture a share menu item can scan: the full-size source, never a video.
 * @param source The media viewer's item.
 * @returns The image URL, or `undefined` for a video or an item without one.
 */
export function scannableImage(source: ShareSource | undefined): string | undefined {
	if (!source || source.videoURI) return undefined;

	const url = source.sourceURI ?? source.uri;

	return url?.startsWith('https://') ? url : undefined;
}

/**
 * @description Tells whether scanned text is a web link worth opening.
 * @param text The QR code's text.
 * @returns Whether it is an http or https link.
 */
export function isWebLink(text: string): boolean {
	return /^https?:\/\/\S+$/i.test(text.trim());
}
