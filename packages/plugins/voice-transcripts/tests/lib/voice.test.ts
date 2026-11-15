import { describe, expect, test } from 'bun:test';

import { audioOf } from '~/lib/voice';

describe('audioOf', () => {
	test('finds a voice message clip and audio attachments', () => {
		expect(
			audioOf({ flags: 8192, attachments: [{ url: 'https://cdn/voice-message.ogg' }] }),
		).toBe('https://cdn/voice-message.ogg');
		expect(
			audioOf({
				attachments: [{ url: 'https://cdn/a.png' }, { url: 'https://cdn/b.mp3?ex=1' }],
			}),
		).toBe('https://cdn/b.mp3?ex=1');
		expect(
			audioOf({ attachments: [{ url: 'https://cdn/x', content_type: 'audio/ogg' }] }),
		).toBe('https://cdn/x');
	});

	test('skips messages without audio', () => {
		expect(audioOf({ attachments: [{ url: 'https://cdn/a.png' }] })).toBeUndefined();
		expect(audioOf(undefined)).toBeUndefined();
	});
});
