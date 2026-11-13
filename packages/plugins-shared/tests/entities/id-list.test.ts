import { expect, test } from 'bun:test';

import { formatIdList, parseIdList } from '~/entities/id-list';

test('splits on commas, spaces and new lines, without duplicates', () => {
	expect(parseIdList(' 1, 2\n3  4,,1 ')).toEqual(['1', '2', '3', '4']);
});

test('reads a setting that is not a string as an empty list', () => {
	expect(parseIdList(undefined)).toEqual([]);
	expect(parseIdList(42)).toEqual([]);
});

test('writes unique trimmed ids that parseIdList reads back in order', () => {
	const stored = formatIdList(['2', ' 1 ', '2', '']);

	expect(stored).toBe('2, 1');
	expect(parseIdList(stored)).toEqual(['2', '1']);
});
