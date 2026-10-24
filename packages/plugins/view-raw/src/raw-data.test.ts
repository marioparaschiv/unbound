import { describe, expect, test } from 'bun:test';

import { cleanMessage, sortKeys } from './raw-data';

describe('sortKeys', () => {
	test('orders keys alphabetically at every depth and keeps array order', () => {
		const sorted = sortKeys({ b: 1, a: { d: [{ z: 1, y: 2 }, 3], c: null } });

		expect(JSON.stringify(sorted)).toBe('{"a":{"c":null,"d":[{"y":2,"z":1},3]},"b":1}');
	});
});

describe('cleanMessage', () => {
	test('drops private author fields and client-only bookkeeping', () => {
		const message = {
			id: '1',
			content: 'hi',
			deleted: false,
			editHistory: [],
			firstEditTimestamp: 0,
			author: {
				id: '2',
				username: 'a',
				email: 'x',
				phone: 'y',
				mfaEnabled: true,
				personalConnectionId: 'z',
			},
			attachments: [{ id: '3', deleted: true }],
		};

		expect(cleanMessage(message)).toEqual({
			attachments: [{ id: '3' }],
			author: { id: '2', username: 'a' },
			content: 'hi',
			id: '1',
		});
	});

	test('leaves the original message untouched', () => {
		const message = { deleted: true, author: { email: 'x' } };

		cleanMessage(message);

		expect(message).toEqual({ deleted: true, author: { email: 'x' } });
	});
});
