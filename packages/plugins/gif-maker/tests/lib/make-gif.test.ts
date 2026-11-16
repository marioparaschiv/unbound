import { describe, expect, test } from 'bun:test';

import { cropRect, outputSize } from '~/lib/frame-size';
import { frameTimes } from '~/lib/make-gif';

describe('frameTimes', () => {
	test('takes frames every 1/fps seconds within the clip', () => {
		expect(frameTimes({ start: 1, length: 0.5, fps: 10 }, 10)).toEqual([1, 1.1, 1.2, 1.3, 1.4]);
	});

	test('stops at the end of the video', () => {
		expect(frameTimes({ start: 9.8, length: 5, fps: 10 }, 10)).toEqual([9.8, 9.9]);
	});
});

describe('frame size', () => {
	test('crops a centred square', () => {
		expect(cropRect(640, 360, 'square')).toEqual({ x: 140, y: 0, width: 360, height: 360 });
	});

	test('keeps the shape at the chosen width, with an even height', () => {
		expect(outputSize({ x: 0, y: 0, width: 640, height: 360 }, 320)).toEqual({
			width: 320,
			height: 180,
		});
		expect(outputSize({ x: 0, y: 0, width: 200, height: 100 }, 320)).toEqual({
			width: 200,
			height: 100,
		});
	});
});
