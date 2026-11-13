import { describe, expect, test } from 'bun:test';

import { othersToClose, withFolderIcon } from '~/lib/folders';

describe('closing other folders', () => {
	test('keeps the opened folder open', () => {
		expect(othersToClose(2, new Set([1, 2, 3]))).toEqual([1, 3]);
	});
});

describe('folder icon on closed folders', () => {
	test('swaps the server preview for the tinted folder icon', () => {
		expect(withFolderIcon([{ type: 'preview' }], 0xff0000)).toEqual([
			{ type: 'icon', tintStyle: { tintColor: '#ff0000' } },
		]);
	});

	test("uses Discord's default color for a folder without one", () => {
		expect(withFolderIcon([{ type: 'preview' }], null)).toEqual([
			{ type: 'icon', tintStyle: { tintColor: '#5865f2' } },
		]);
	});

	test('leaves an open folder alone', () => {
		const items = [{ type: 'icon' }];

		expect(withFolderIcon(items, 1)).toBe(items);
	});
});
