import { describe, expect, test } from 'bun:test';

import { compactMessage, displayName, type CompactMessage } from '~/lib/compact';

describe('displayName', () => {
	test('drops the handle Discord adds in brackets', () => {
		expect(displayName('adrián (@dylib.dev)')).toBe('adrián');
		expect(displayName('rairof')).toBe('rairof');
	});
});

describe('compactMessage', () => {
	test('drops the header and puts the bold name first', () => {
		const message: CompactMessage = {
			username: 'Rairof (@rairof)',
			avatarURL: 'https://cdn/a.png',
			timestamp: '6:10 AM',
			timestampTooltip: 'Sunday',
			isFirst: true,
			content: [{ type: 'text', content: 'Oh I see' }],
		};

		expect(compactMessage(message, true)).toBe(true);
		expect(message).toEqual({
			username: 'Rairof (@rairof)',
			avatarURL: undefined,
			timestamp: undefined,
			timestampTooltip: undefined,
			isFirst: false,
			content: [
				{ type: 'strong', content: [{ type: 'text', content: 'Rairof' }] },
				{ type: 'text', content: '  ' },
				{ type: 'text', content: 'Oh I see' },
			],
		});
	});

	test('prefers the name it is given over the row username', () => {
		const message: CompactMessage = {
			username: 'dylib.dev',
			content: [{ type: 'text', content: 'hi' }],
		};

		compactMessage(message, true, 'adrián');
		expect(message.content?.[0]).toEqual({
			type: 'strong',
			content: [{ type: 'text', content: 'adrián' }],
		});
	});

	test('leaves rows without an author or content alone', () => {
		expect(compactMessage({ content: [] }, true)).toBe(false);
		expect(compactMessage({ username: 'a' }, true)).toBe(false);
	});
});
