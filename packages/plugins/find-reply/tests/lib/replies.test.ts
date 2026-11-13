import { describe, expect, test } from 'bun:test';

import { firstReplyTo } from '~/lib/replies';

describe('finding replies', () => {
	test('picks the earliest reply, by snowflake order', () => {
		const loaded = [
			{ id: '1000000000000000020', messageReference: { message_id: '9' } },
			{ id: '1000000000000000010', messageReference: { message_id: '9' } },
			{ id: '1000000000000000005', messageReference: { message_id: '8' } },
		];

		expect(firstReplyTo(loaded, '9')).toBe('1000000000000000010');
	});

	test('reads API messages and finds nothing for an unanswered message', () => {
		const fetched = [{ id: '30', message_reference: { message_id: '7' } }, { id: '31' }];

		expect(firstReplyTo(fetched, '7')).toBe('30');
		expect(firstReplyTo(fetched, '6')).toBeUndefined();
	});
});
