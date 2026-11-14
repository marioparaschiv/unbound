import { describe, expect, test } from 'bun:test';

import { repliesToMe } from '~/lib/replies';

const authors: Record<string, string> = { mine: 'me', theirs: 'them' };
const authorOf = (id: string) => authors[id];

describe('replies to me', () => {
	test('matches a reply to my message from someone else', () => {
		expect(
			repliesToMe(
				{ author: { id: 'them' }, messageReference: { message_id: 'mine' } },
				'me',
				authorOf,
			),
		).toBe(true);
	});

	test('skips my own replies, replies to others and plain messages', () => {
		expect(
			repliesToMe(
				{ author: { id: 'me' }, messageReference: { message_id: 'mine' } },
				'me',
				authorOf,
			),
		).toBe(false);
		expect(
			repliesToMe(
				{ author: { id: 'them' }, messageReference: { message_id: 'theirs' } },
				'me',
				authorOf,
			),
		).toBe(false);
		expect(repliesToMe({ author: { id: 'them' } }, 'me', authorOf)).toBe(false);
	});
});
