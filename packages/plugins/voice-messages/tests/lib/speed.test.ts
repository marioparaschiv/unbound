import { describe, expect, test } from 'bun:test';

import { isAudioAttachment, parseSpeed } from '~/lib/speed';

describe('voice message speed', () => {
	test('applies to audio attachments only', () => {
		expect(
			isAudioAttachment(
				'https://cdn.discordapp.com/attachments/1/2/voice-message.ogg?ex=1&hm=2',
			),
		).toBe(true);
		expect(isAudioAttachment('https://cdn.discordapp.com/attachments/1/2/tone.mp3')).toBe(true);
		expect(isAudioAttachment('https://cdn.discordapp.com/attachments/1/2/clip.mp4?ex=1')).toBe(
			false,
		);
		expect(isAudioAttachment('https://example.com/a.ogg')).toBe(false);
	});

	test('reads the setting, falling back to normal speed', () => {
		expect(parseSpeed('1.5')).toBe(1.5);
		expect(parseSpeed('fast')).toBe(1);
		expect(parseSpeed('10')).toBe(1);
	});
});
