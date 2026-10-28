import { describe, expect, test } from 'bun:test';

import { isSafeAddonId, isSafeAddonMain, safeFontFileName, safeRelativePath } from './addon-paths';

describe('addon paths', () => {
	test('addon ids must be plain folder names', () => {
		expect(isSafeAddonId('unbound.moyai')).toBe(true);

		for (const id of ['../settings', 'a/b', '', '.hidden', 'a..b', 'x'.repeat(101), 7]) {
			expect(isSafeAddonId(id)).toBe(false);
		}
	});

	test('main must stay inside the addon', () => {
		for (const main of ['index.js', 'dist/index.js', 'a-b/c_d.js']) {
			expect(isSafeAddonMain(main)).toBe(true);
		}

		for (const main of [
			'../settings.json',
			'/etc/hosts',
			'a/../../b.js',
			'./index.js',
			'',
			'.index.js',
			'a\\b.js',
			null,
		]) {
			expect(isSafeAddonMain(main)).toBe(false);
		}
	});

	test('listing paths keep only plain segments', () => {
		expect(safeRelativePath('drawable/icon.png')).toBe('drawable/icon.png');

		for (const path of ['', '/abs', '../up', 'a/../b', 'a/./b', 'a//b', 'a\\b', 'a\0b']) {
			expect(safeRelativePath(path)).toBeUndefined();
		}
	});

	test('font file names lose paths, queries and unsafe characters', () => {
		expect(safeFontFileName('https://cdn.example/fonts/Inter-Bold.ttf', 'f.ttf')).toBe(
			'Inter-Bold.ttf',
		);
		expect(safeFontFileName('https://cdn.example/Inter.otf?v=2#x', 'f.ttf')).toBe('Inter.otf');
		expect(safeFontFileName('https://cdn.example/..%2F..%2Fsettings.ttf', 'f.ttf')).toBe(
			'settings.ttf',
		);
		expect(safeFontFileName('https://cdn.example/%2e%2e', 'f.ttf')).toBe('f.ttf');
		expect(safeFontFileName('https://cdn.example/fonts/', 'f.ttf')).toBe('f.ttf');
		expect(safeFontFileName('https://cdn.example/not-a-font.js', 'f.ttf')).toBe('f.ttf');
		expect(safeFontFileName('https://cdn.example/%E0%A4%A', 'f.ttf')).toBe('f.ttf');
	});
});
