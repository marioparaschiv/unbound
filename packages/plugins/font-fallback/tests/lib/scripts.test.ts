import { describe, expect, test } from 'bun:test';

import { scriptRuns, type ScriptId } from '~/lib/scripts';

const all = new Set<ScriptId>(['latin', 'cyrillic', 'han', 'kana', 'hangul', 'arabic']);

describe('scriptRuns', () => {
	test('splits mixed text into one run per script', () => {
		expect(scriptRuns('hi 你好 привет', all)).toEqual([
			{ script: 'latin', start: 0, length: 2 },
			{ script: 'han', start: 3, length: 2 },
			{ script: 'cyrillic', start: 6, length: 6 },
		]);
	});

	test('keeps spaces between words of one script inside its run', () => {
		expect(scriptRuns('привет мир', all)).toEqual([
			{ script: 'cyrillic', start: 0, length: 10 },
		]);
	});

	test('tells kana from han and hangul', () => {
		expect(scriptRuns('日本語ですか안녕', all).map(({ script }) => script)).toEqual([
			'han',
			'kana',
			'hangul',
		]);
	});

	test('leaves digits, punctuation and emoji out', () => {
		expect(scriptRuns('42! 😀 ok', all)).toEqual([{ script: 'latin', start: 7, length: 2 }]);
	});

	test('counts UTF-16 units for characters outside the BMP', () => {
		expect(scriptRuns('😀𠀀', all)).toEqual([{ script: 'han', start: 2, length: 2 }]);
	});

	test('skips scripts without a font', () => {
		expect(scriptRuns('abc мир', new Set<ScriptId>(['cyrillic']))).toEqual([
			{ script: 'cyrillic', start: 4, length: 3 },
		]);
	});
});
