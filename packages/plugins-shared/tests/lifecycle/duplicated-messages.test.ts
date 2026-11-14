import { describe, expect, test } from 'bun:test';

import { duplicatedMessages } from '~/lifecycle/duplicated-messages';

const row = (id?: string) => ({ type: 1, message: id ? { id } : null });

describe('chat rows', () => {
	test('finds messages a chat shows twice', () => {
		expect(
			duplicatedMessages([row('1'), row('2'), row('1'), row(), row('2'), row('1')]),
		).toEqual(['1', '2']);
	});

	test('passes rows without repeats, separators included', () => {
		expect(duplicatedMessages([row('1'), row(), row(), row('2')])).toEqual([]);
	});
});
