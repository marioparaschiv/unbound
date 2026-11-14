import { describe, expect, test } from 'bun:test';

import { toBase64, voiceFile } from '~/lib/voice-message';

describe('voice message file', () => {
	test("reads a voice message's audio file", () => {
		expect(
			voiceFile({
				id: '1',
				flags: 8192,
				attachments: [{ url: 'https://cdn/x.ogg', filename: 'x.ogg' }],
			}),
		).toEqual({ url: 'https://cdn/x.ogg', filename: 'voice-message-1.ogg' });
	});

	test('ignores other messages', () => {
		expect(voiceFile({ flags: 0, attachments: [{ url: 'u' }] })).toBeUndefined();
		expect(voiceFile({ flags: 8192, attachments: [] })).toBeUndefined();
	});
});

describe('base64', () => {
	test('matches the standard encoding, padding included', () => {
		for (const text of ['', 'f', 'fo', 'foo', 'foob', 'voice']) {
			expect(toBase64(new TextEncoder().encode(text))).toBe(
				Buffer.from(text).toString('base64'),
			);
		}
	});
});
