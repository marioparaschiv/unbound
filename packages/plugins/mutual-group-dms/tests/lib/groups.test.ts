import { describe, expect, test } from 'bun:test';

import { mutualGroups, type GroupChannel } from '~/lib/groups';

const names: Record<string, string> = { a: 'Ann', b: 'Ben', c: 'Cat', d: 'Dan', e: 'Eve' };
const nameOf = (id: string) => names[id];

describe('mutual group DMs', () => {
	test('keeps only the group DMs the user is in, in Discord order', () => {
		const channels: GroupChannel[] = [
			{ id: '1', type: 3, name: 'Weekend', recipients: ['a', 'b'] },
			{ id: '2', type: 1, recipients: ['a'] },
			{ id: '3', type: 3, recipients: ['b', 'c'] },
			{ id: '4', type: 3, recipients: ['a', 'c'] },
		];

		expect(mutualGroups(channels, 'a', nameOf)).toEqual([
			{ id: '1', name: 'Weekend' },
			{ id: '4', name: 'Ann, Cat' },
		]);
	});

	test('names an unnamed group after its first members', () => {
		const channels: GroupChannel[] = [
			{ id: '5', type: 3, recipients: ['a', 'b', 'c', 'd', 'e'] },
		];

		expect(mutualGroups(channels, 'e', nameOf)[0]?.name).toBe('Ann, Ben, Cat +2');
	});
});
