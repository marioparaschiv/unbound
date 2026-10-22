import { expect, test } from 'bun:test';

import {
	addUserId,
	editUserId,
	isUserId,
	parseUserList,
	removeUserId,
} from '@no-reply-mention/user-list';

const first = '100000000000000001';
const second = '100000000000000002';
const third = '100000000000000003';

test('parses comma and whitespace separated user IDs without duplicates', () => {
	expect(parseUserList(` ${first},${second}\n${first} `)).toEqual([first, second]);
});

test('adds a user ID without duplicating an existing entry', () => {
	expect(addUserId(`${first}\n${second}`, third)).toBe(`${first}\n${second}\n${third}`);
	expect(addUserId(`${first}\n${second}`, first)).toBe(`${first}\n${second}`);
});

test('edits an entry and removes duplicate replacements', () => {
	expect(editUserId(`${first}\n${second}`, first, third)).toBe(`${third}\n${second}`);
	expect(editUserId(`${first}\n${second}`, first, second)).toBe(second);
});

test('removes a user ID', () => {
	expect(removeUserId(`${first}\n${second}`, first)).toBe(second);
});

test('recognizes Discord snowflake-shaped user IDs', () => {
	expect(isUserId(first)).toBe(true);
	expect(isUserId('not-a-user-id')).toBe(false);
});
