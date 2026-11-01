import { describe, expect, test } from 'bun:test';

import { findBadgeImageProblem } from '~/lib/sponsors/badge-image';

import { encodePng, noise } from './helpers/png';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

describe('findBadgeImageProblem', () => {
	test.each([64, 128, 256])('accepts a square %i px PNG', (width) => {
		expect(findBadgeImageProblem(encodePng({ width }))).toBeUndefined();
	});

	test.each([
		['63 px', encodePng({ width: 63 }), '64 to 256 px wide; this one is 63 px'],
		['257 px', encodePng({ width: 257 }), '64 to 256 px wide; this one is 257 px'],
		['not square', encodePng({ width: 128, height: 96 }), 'square; this one is 128×96 px'],
		['over 64 KB', encodePng({ width: 256, pixel: noise() }), '64 KB or smaller'],
		['animated', encodePng({ width: 128, animated: true }), 'animated PNGs are not allowed'],
		['a JPEG', JPEG, 'must be PNG files'],
		['empty', new Uint8Array(), 'must be PNG files'],
		['truncated', encodePng({ width: 128 }).subarray(0, 60), 'not a complete PNG file'],
		['cut before IEND', encodePng({ width: 128 }).slice(0, -12), 'not a complete PNG file'],
	] as const)('refuses %s', (_name, bytes, problem) => {
		expect(findBadgeImageProblem(bytes)).toContain(problem);
	});

	test('the noise PNG above is over the limit by its bytes, not its size in pixels', () => {
		const bytes = encodePng({ width: 256, pixel: noise() });

		expect(bytes.byteLength).toBeGreaterThan(64 * 1024);
	});
});
