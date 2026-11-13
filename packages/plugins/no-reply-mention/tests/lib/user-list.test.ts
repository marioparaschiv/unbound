import { expect, test } from 'bun:test';

import { formatUserList, parseUserList, shouldMention } from '~/lib/user-list';

const first = '100000000000000001';
const second = '100000000000000002';
const third = '100000000000000003';

test('parses comma and whitespace separated user IDs without duplicates', () => {
	expect(parseUserList(` ${first},${second}\n${first} `)).toEqual([first, second]);
});

test('reads a setting that is not a string as an empty list', () => {
	expect(parseUserList(undefined)).toEqual([]);
	expect(parseUserList(42)).toEqual([]);
});

test('mentions only listed authors, and only when listed users may be pinged', () => {
	const userList = `${first}\n${second}`;

	expect(shouldMention(first, userList, true)).toBe(true);
	expect(shouldMention(third, userList, true)).toBe(false);
	expect(shouldMention(first, userList, false)).toBe(false);
	expect(shouldMention(undefined, userList, true)).toBe(false);
});

test('writes one unique ID per line', () => {
	expect(formatUserList([first, ` ${second} `, first, ''])).toBe(`${first}\n${second}`);
});
