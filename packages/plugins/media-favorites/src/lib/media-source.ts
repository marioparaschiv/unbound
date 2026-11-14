export type MediaSource = {
	uri?: string;
	sourceURI?: string;
	embedURI?: string;
	contentType?: string;
	isGIFV?: boolean;
};

/**
 * @description Reports whether a media viewer source is a video, which Discord's favorites store as a video.
 * @param source The source the media viewer shows.
 * @returns Whether it is a video.
 */
export function isVideoSource(source: MediaSource): boolean {
	return Boolean(source.contentType?.startsWith('video/'));
}

/**
 * @description Describes a video the way Discord's favorite button expects a GIFV, so the favorite keeps playing as a
 * video in the GIF picker.
 * @param source The source the media viewer shows.
 * @returns The source to favorite.
 */
export function asFavoritableSource<T extends MediaSource>(source: T): T {
	if (!isVideoSource(source) || source.isGIFV) return source;

	return { ...source, isGIFV: true, embedURI: source.embedURI ?? source.sourceURI ?? source.uri };
}
