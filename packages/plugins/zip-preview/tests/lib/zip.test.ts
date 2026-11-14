import { describe, expect, test } from 'bun:test';

import { formatSize, listZip } from '~/lib/zip';

import { storedZip } from '../helpers/zip';

describe('listZip', () => {
	test('lists files with their sizes and skips folders', () => {
		const archive = storedZip({
			'readme.md': 'hello',
			'src/': '',
			'src/main.ts': 'x'.repeat(2048),
			'日本語.txt': '名前',
		});

		expect(listZip(archive)).toEqual([
			{ name: 'readme.md', size: 5 },
			{ name: 'src/main.ts', size: 2048 },
			{ name: '日本語.txt', size: 6 },
		]);
	});

	test('refuses bytes that are not an archive', () => {
		expect(
			listZip(new TextEncoder().encode('not a zip at all, just some text')),
		).toBeUndefined();
		expect(listZip(new Uint8Array(4))).toBeUndefined();
	});

	test('formats sizes', () => {
		expect(formatSize(512)).toBe('512 B');
		expect(formatSize(2048)).toBe('2.0 KB');
		expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
	});
});
