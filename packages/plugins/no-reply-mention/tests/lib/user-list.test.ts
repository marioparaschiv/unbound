import { expect, test } from 'bun:test';

import { shouldMention } from '~/lib/user-list';

const first = '100000000000000001';
const second = '100000000000000002';
const third = '100000000000000003';

test('mentions only listed authors, and only when listed users may be pinged', () => {
	const userList = `${first}\n${second}`;

	expect(shouldMention(first, userList, true)).toBe(true);
	expect(shouldMention(third, userList, true)).toBe(false);
	expect(shouldMention(first, userList, false)).toBe(false);
	expect(shouldMention(undefined, userList, true)).toBe(false);
});
