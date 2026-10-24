import { describe, expect, test } from 'bun:test';

import { formatBytes, sizeBadgesForRow, type MediaItemElement } from './badges';

function item(key: string | null, fileSize: number | undefined, size: number): MediaItemElement {
	return { key, type: 'item', props: { item: { node: { image: { fileSize } } }, size } };
}

describe('formatBytes', () => {
	test('uses binary units with up to two decimals', () => {
		expect(formatBytes(0)).toBe('0 Bytes');
		expect(formatBytes(1023)).toBe('1023 Bytes');
		expect(formatBytes(1024)).toBe('1 KB');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(1_234_567)).toBe('1.18 MB');
		expect(formatBytes(1023.5 * 1024 ** 2)).toBe('1023.5 MB');
	});
});

describe('sizeBadgesForRow', () => {
	test('places a badge in the top-left corner of each slot', () => {
		const badges = sizeBadgesForRow([item('a', 2048, 100), item(null, 0, 100)], 12, 4);

		expect(badges).toEqual([
			{ key: 'file-size-a', label: '2 KB', left: 15 },
			{ key: 'file-size-1', label: '0 Bytes', left: 119 },
		]);
	});

	test('skips items without a valid file size or layout size, keeping slot positions', () => {
		const badges = sizeBadgesForRow(
			[item('a', undefined, 100), item('b', -1, 100), item('c', 10, 0), item('d', 10, 100)],
			0,
			0,
		);

		expect(badges).toEqual([{ key: 'file-size-d', label: '10 Bytes', left: 303 }]);
	});
});
