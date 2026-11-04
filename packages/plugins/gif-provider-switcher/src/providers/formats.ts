export type TenorFormat = 'webp' | 'tinywebm' | 'tinymp4';

export type GiphyFormat = 'webp' | 'mp4';

function isWebp(mediaFormat: string): boolean {
	return /webp/i.test(mediaFormat);
}

/**
 * @description Picks the Tenor rendition matching the media format Discord asked for. Mobile asks for MP4, which iOS and Android both play.
 * @param mediaFormat The `media_format` Discord sent, such as `mp4`, `webm` or `tinywebp`.
 * @returns The Tenor media key to read.
 */
export function pickTenorFormat(mediaFormat: string): TenorFormat {
	if (isWebp(mediaFormat)) return 'webp';

	return /webm/i.test(mediaFormat) ? 'tinywebm' : 'tinymp4';
}

/**
 * @description Picks the Giphy rendition matching the media format Discord asked for. Giphy has no WebM, so anything but WebP gets MP4.
 * @param mediaFormat The `media_format` Discord sent.
 * @returns The Giphy image field to read.
 */
export function pickGiphyFormat(mediaFormat: string): GiphyFormat {
	return isWebp(mediaFormat) ? 'webp' : 'mp4';
}
