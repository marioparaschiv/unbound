import { describe, expect, test } from 'bun:test';

import { windowAspect } from '~/lib/aspect';

describe('windowAspect', () => {
	test('uses the video size as it is when Android allows it', () => {
		expect(windowAspect(1920, 1080)).toEqual([1920, 1080]);
		expect(windowAspect(720, 1280)).toEqual([720, 1280]);
	});

	test('rounds sizes that are not whole numbers', () => {
		expect(windowAspect(400.5, 300)).toEqual([1335, 1000]);
	});

	test('clamps very wide and very tall videos to the limits Android allows', () => {
		expect(windowAspect(3000, 100)).toEqual([239, 100]);
		expect(windowAspect(100, 3000)).toEqual([100, 239]);
		expect(windowAspect(4184, 10_000)).toEqual([100, 239]);
	});

	test('falls back to 16:9 without a usable size', () => {
		expect(windowAspect(undefined, 1080)).toEqual([16, 9]);
		expect(windowAspect(1920, 0)).toEqual([16, 9]);
		expect(windowAspect(Number.NaN, 10)).toEqual([16, 9]);
	});
});
