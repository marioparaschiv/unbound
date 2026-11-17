import type { Attachment } from '~/lib/svg';

export type RasterFormat = 'avif' | 'heic' | 'tiff' | 'bmp' | 'ico' | 'jxl';

const MAX_RASTER_BYTES = 25 * 1024 * 1024;

const BY_EXTENSION: Record<string, RasterFormat> = {
	avif: 'avif',
	heic: 'heic',
	heif: 'heic',
	tif: 'tiff',
	tiff: 'tiff',
	bmp: 'bmp',
	ico: 'ico',
	jxl: 'jxl',
};

const BY_TYPE: Record<string, RasterFormat> = {
	'image/avif': 'avif',
	'image/heic': 'heic',
	'image/heif': 'heic',
	'image/tiff': 'tiff',
	'image/bmp': 'bmp',
	'image/x-ms-bmp': 'bmp',
	'image/x-icon': 'ico',
	'image/vnd.microsoft.icon': 'ico',
	'image/jxl': 'jxl',
};

/**
 * @description Reads which image format an attachment is in, among those Discord shows only as a file.
 * @param attachment The attachment.
 * @returns The format, or `undefined` for other files and ones over 25 MB.
 */
export function rasterFormat(attachment: Attachment): RasterFormat | undefined {
	const { filename = '', size = 0, content_type: type = '' } = attachment;

	if (!attachment.url || size > MAX_RASTER_BYTES) return undefined;

	return (
		BY_TYPE[type.split(';')[0]!.trim().toLowerCase()] ??
		BY_EXTENSION[filename.split('.').at(-1)?.toLowerCase() ?? '']
	);
}

/**
 * @description Whether this platform's decoder reads a format: iOS's ImageIO reads all of them, Android's ImageDecoder
 * every one but TIFF and JPEG XL.
 * @param format The format.
 * @param platform The platform.
 * @returns Whether to draw it.
 */
export function canDecode(format: RasterFormat, platform: 'ios' | 'android'): boolean {
	return platform === 'ios' || (format !== 'tiff' && format !== 'jxl');
}
