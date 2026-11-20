import { describe, expect, test } from 'bun:test';

import { unknownUserId } from '~/lib/mention-event';

describe('unknownUserId', () => {
	test('reads the parsed id of a mention Discord has not loaded', () => {
		expect(unknownUserId({ nativeEvent: { parsedUserId: '80351110224678912' } })).toBe(
			'80351110224678912',
		);
	});

	test('leaves loaded users, roles and anything else alone', () => {
		expect(
			unknownUserId({ nativeEvent: { userId: '1', parsedUserId: '80351110224678912' } }),
		).toBeUndefined();
		expect(
			unknownUserId({ nativeEvent: { roleId: '2', parsedUserId: '80351110224678912' } }),
		).toBeUndefined();
		expect(unknownUserId({ nativeEvent: { parsedUserId: 'everyone' } })).toBeUndefined();
		expect(unknownUserId(undefined)).toBeUndefined();
	});
});
