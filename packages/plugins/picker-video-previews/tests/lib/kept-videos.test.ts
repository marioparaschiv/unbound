import { describe, expect, test } from 'bun:test';

import { keptWithin } from '~/lib/kept-videos';

const MB = 1024 * 1024;

describe('kept videos', () => {
	test('keeps the newest few while they fit', () => {
		const videos = [1, 2, 3, 4].map((handle) => ({ handle, bytes: 10 * MB }));

		expect(keptWithin(videos, 500 * MB, 3).map((video) => video.handle)).toEqual([2, 3, 4]);
	});

	test('drops older videos once the total passes the size', () => {
		const videos = [
			{ handle: 1, bytes: 300 * MB },
			{ handle: 2, bytes: 150 * MB },
			{ handle: 3, bytes: 200 * MB },
		];

		expect(keptWithin(videos, 500 * MB, 3).map((video) => video.handle)).toEqual([2, 3]);
	});

	test('always keeps the newest, however large', () => {
		const videos = [
			{ handle: 1, bytes: 5 * MB },
			{ handle: 2, bytes: 4000 * MB },
		];

		expect(keptWithin(videos, 500 * MB, 3).map((video) => video.handle)).toEqual([2]);
	});
});
