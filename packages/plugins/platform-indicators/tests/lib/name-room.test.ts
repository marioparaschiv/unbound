import { describe, expect, test } from 'bun:test';

import { roomForName, type HeaderRow } from '~/lib/name-room';

const frame = (x: number, width: number) => ({ x, y: 0, width, height: 20 });

const crowded: HeaderRow = {
	row: frame(0, 291),
	container: frame(0, 200),
	name: frame(0, 2),
	label: frame(0, 2),
	tags: frame(6, 194),
	timestamp: frame(204, 87),
};

describe('roomForName', () => {
	test('gives a squeezed name room from the end of the timestamp', () => {
		const header = roomForName(
			{ ...crowded, row: frame(0, 310), timestamp: frame(204, 106) },
			120,
		);

		expect(header?.name).toEqual(frame(0, 64));
		expect(header?.label.width).toBe(64);
		expect(header?.tags?.x).toBe(68);
		expect(header?.container.width).toBe(262);
		expect(header?.timestamp).toEqual(frame(266, 44));
	});

	test('keeps the start of the timestamp', () => {
		const header = roomForName({ ...crowded, timestamp: frame(231, 60) }, 120);

		expect(header?.timestamp).toEqual(frame(251, 40));
		expect(header?.name.width).toBe(22);
	});

	test('wants no more room than the name draws', () => {
		expect(roomForName(crowded, 20)?.name.width).toBe(20);
	});

	test('leaves a header that fits alone', () => {
		expect(roomForName({ ...crowded, timestamp: frame(204, 50) }, 120)).toBeUndefined();
		expect(roomForName({ ...crowded, name: frame(0, 70) }, 120)).toBeUndefined();
	});
});
