import { describe, expect, test } from 'bun:test';

import { canDecode, rasterFormat } from '~/lib/raster-formats';

describe('raster formats', () => {
	test('read the format from the type, then the extension', () => {
		expect(rasterFormat({ url: 'u', filename: 'a.HEIC' })).toBe('heic');
		expect(rasterFormat({ url: 'u', filename: 'x', content_type: 'image/avif' })).toBe('avif');
		expect(rasterFormat({ url: 'u', filename: 'scan.tif' })).toBe('tiff');
		expect(rasterFormat({ url: 'u', filename: 'a.png' })).toBeUndefined();
		expect(
			rasterFormat({ url: 'u', filename: 'a.bmp', size: 30 * 1024 * 1024 }),
		).toBeUndefined();
	});

	test('leave TIFF and JPEG XL to iOS', () => {
		expect(canDecode('tiff', 'ios')).toBe(true);
		expect(canDecode('tiff', 'android')).toBe(false);
		expect(canDecode('avif', 'android')).toBe(true);
	});
});
