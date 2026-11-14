/** What the media viewer's share menu knows about the item it shows. */
export type ShareSource = {
	uri?: string;
	sourceURI?: string;
	videoURI?: string;
	shareURI?: string;
};

/**
 * @description Picks the image a share menu item can copy: the full-size source of a picture, never a video.
 * @param source The media viewer's item.
 * @returns The image URL, or `undefined` for a video or an item without one.
 */
export function copyableImage(source: ShareSource | undefined): string | undefined {
	if (!source || source.videoURI) return undefined;

	const url = source.sourceURI ?? source.uri;

	return url?.startsWith('https://') ? url : undefined;
}

export default copyableImage;
