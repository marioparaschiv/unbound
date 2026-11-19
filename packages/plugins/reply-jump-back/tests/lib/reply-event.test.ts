import { describe, expect, test } from 'bun:test';

import { tappedReplyId } from '~/lib/reply-event';

describe('tappedReplyId', () => {
	test('reads the replying message from the native event', () => {
		expect(tappedReplyId({ nativeEvent: { target: 490, originId: '1', timeStamp: 2 } })).toBe(
			'1',
		);
		expect(tappedReplyId({ nativeEvent: {} })).toBeUndefined();
		expect(tappedReplyId(null)).toBeUndefined();
	});
});
