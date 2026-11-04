import { describe, expect, test } from 'bun:test';

import {
	findBadgeImageProblem,
	getBadgeImageKey,
	getBadgeImageType,
	hashBadgeImage,
} from '~/lib/sponsors/badge-image';

import { encodeGif } from './helpers/gif';
import { encodePng } from './helpers/png';

const ANIMATED = encodeGif({
	width: 128,
	colors: [
		[237, 66, 69],
		[88, 101, 242],
	],
});

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

describe('findBadgeImageProblem', () => {
	const MB = 1024 * 1024;

	test.each([64, 128, 256])('accepts a square %i px PNG', (width) => {
		expect(findBadgeImageProblem(encodePng({ width }))).toBeUndefined();
	});

	test('accepts a still or an animated square GIF', () => {
		expect(findBadgeImageProblem(encodeGif({ width: 64 }))).toBeUndefined();
		expect(findBadgeImageProblem(ANIMATED)).toBeUndefined();
	});

	test('names and stores a GIF as a GIF, and a PNG under its bare hash as before', () => {
		const gif = hashBadgeImage(ANIMATED);
		const png = hashBadgeImage(encodePng({ width: 128 }));

		expect(gif).toMatch(/^[0-9a-f]{64}\.gif$/);
		expect([getBadgeImageKey(gif), getBadgeImageType(gif)]).toEqual([
			`badges/${gif}`,
			'image/gif',
		]);
		expect(png).toMatch(/^[0-9a-f]{64}$/);
		expect([getBadgeImageKey(png), getBadgeImageType(png)]).toEqual([
			`badges/${png}.png`,
			'image/png',
		]);
	});

	test('accepts a PNG of exactly 5 MB', () => {
		const png = encodePng({ width: 128 });
		const bytes = encodePng({ width: 128, padding: 5 * MB - png.byteLength - 12 });

		expect(bytes.byteLength).toBe(5 * MB);
		expect(findBadgeImageProblem(bytes)).toBeUndefined();
	});

	test.each([
		['63 px', encodePng({ width: 63 }), '64 to 256 px wide; this one is 63 px'],
		['257 px', encodePng({ width: 257 }), '64 to 256 px wide; this one is 257 px'],
		['not square', encodePng({ width: 128, height: 96 }), 'square; this one is 128×96 px'],
		['over 5 MB', encodePng({ width: 128, padding: 5 * MB }), 'must be 5 MB or smaller'],
		[
			'an animated PNG',
			encodePng({ width: 128, animated: true }),
			'upload the animation as a GIF',
		],
		['a JPEG', JPEG, 'must be PNG or GIF files'],
		['empty', new Uint8Array(), 'must be PNG or GIF files'],
		[
			'a GIF that is not square',
			encodeGif({ width: 128, height: 96 }),
			'square; this one is 128×96 px',
		],
		['a 300 px GIF', encodeGif({ width: 300 }), '64 to 256 px wide; this one is 300 px'],
		['a truncated GIF', ANIMATED.subarray(0, 200), 'not a complete GIF file'],
		['truncated', encodePng({ width: 128 }).subarray(0, 60), 'not a complete PNG file'],
		['cut before IEND', encodePng({ width: 128 }).slice(0, -12), 'not a complete PNG file'],
	] as const)('refuses %s', (_name, bytes, problem) => {
		expect(findBadgeImageProblem(bytes)).toContain(problem);
	});
});
