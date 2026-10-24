import { describe, expect, test } from 'bun:test';

import { sameIds, visibleTypingIds } from './typing-users';

const typing = { self: 1, blocked: 2, ignored: 3, visible: 4 };
const relationships = {
	isBlocked: (id: string) => id === 'blocked',
	isIgnored: (id: string) => id === 'ignored',
};

describe('visibleTypingIds', () => {
	test('hides the current user, blocked users, and ignored users by default', () => {
		const ids = visibleTypingIds(typing, {
			currentUserId: 'self',
			includeBlocked: false,
			includeIgnored: false,
			...relationships,
		});

		expect(ids).toEqual(['visible']);
	});

	test('includes blocked and ignored users when asked, still hiding the current user', () => {
		const ids = visibleTypingIds(typing, {
			currentUserId: 'self',
			includeBlocked: true,
			includeIgnored: true,
			...relationships,
		});

		expect(ids).toEqual(['blocked', 'ignored', 'visible']);
	});

	test('shows nobody for a channel without a typing snapshot', () => {
		const ids = visibleTypingIds(undefined, {
			currentUserId: 'self',
			includeBlocked: false,
			includeIgnored: false,
			...relationships,
		});

		expect(ids).toEqual([]);
	});
});

describe('sameIds', () => {
	test('treats only the same IDs in the same order as unchanged', () => {
		expect(sameIds(['a', 'b'], ['a', 'b'])).toBe(true);
		expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(false);
		expect(sameIds(['a'], ['a', 'b'])).toBe(false);
	});
});
