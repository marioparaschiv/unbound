import { describe, expect, test } from 'bun:test';

import { parseFolderIcons, photoUri, withCustomIcon } from '~/lib/folder-icons';

describe('custom folder icons', () => {
	test('sets and removes one folder icon', () => {
		const saved = withCustomIcon('', '12', 'data:a');

		expect(parseFolderIcons(saved)).toEqual({ 12: 'data:a' });
		expect(parseFolderIcons(withCustomIcon(saved, '34', 'data:b'))).toEqual({
			12: 'data:a',
			34: 'data:b',
		});
		expect(parseFolderIcons(withCustomIcon(saved, '12', undefined))).toEqual({});
	});

	test('ignores a broken setting', () => {
		expect(parseFolderIcons('{')).toEqual({});
		expect(parseFolderIcons('[1]')).toEqual({});
		expect(parseFolderIcons('{"1":2}')).toEqual({});
	});

	test('builds a data URI, JPEG unless told otherwise', () => {
		expect(photoUri('QUJD')).toBe('data:image/jpeg;base64,QUJD');
		expect(photoUri('QUJD', 'image/png')).toBe('data:image/png;base64,QUJD');
	});
});
