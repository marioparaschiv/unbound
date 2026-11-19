import { describe, expect, test } from 'bun:test';

import { badgedHeader, type HeaderFrames } from '~/lib/header-layout';

const BADGE = { width: 16, height: 20 };

const frame = (x: number, width: number, y = 0, height = 20) => ({ x, y, width, height });

const header: HeaderFrames = {
	row: frame(0, 300),
	container: frame(0, 140),
	name: frame(0, 70),
	label: frame(0, 70, 2, 16),
	tags: frame(74, 66),
	timestamp: frame(144, 50, 4, 16),
};

describe('badgedHeader', () => {
	test('puts the badge where the name started and moves everything after it', () => {
		const { icon, frames } = badgedHeader(header, BADGE);

		expect(icon).toEqual({ x: 0, y: 0, width: 16, height: 20 });
		expect(frames.name).toEqual(frame(16, 70));
		expect(frames.tags).toEqual(frame(90, 66));
		expect(frames.container).toEqual(frame(0, 156));
		expect(frames.timestamp).toEqual(frame(160, 50, 4, 16));
	});

	test('takes the room a full row lacks from the name', () => {
		const { frames } = badgedHeader({ ...header, row: frame(0, 200) }, BADGE);

		expect(frames.name).toEqual(frame(16, 60));
		expect(frames.label.width).toBe(60);
		expect(frames.tags?.x).toBe(80);
		expect(frames.timestamp?.x).toBe(150);
	});

	test('takes the badge from a name already cut short', () => {
		const { frames } = badgedHeader(header, BADGE, 120);

		expect(frames.name).toEqual(frame(16, 54));
		expect(frames.tags?.x).toBe(74);
		expect(frames.container.width).toBe(140);
	});

	test('leaves a timestamp that sits inside the name row where it is', () => {
		const timestamp = frame(100, 50, 4, 16);
		const { frames } = badgedHeader({ ...header, timestamp }, BADGE);

		expect(frames.timestamp).toEqual(timestamp);
	});
});
