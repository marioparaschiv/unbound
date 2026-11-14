import { expect, test } from 'bun:test';

import { isAudioAttachment } from '~/media/audio-attachment';

test('recognises audio attachments on Discord CDN only', () => {
	expect(
		isAudioAttachment(
			'https://cdn.discordapp.com/attachments/1/2/voice-message.ogg?ex=6&is=7&hm=8',
		),
	).toBe(true);
	expect(isAudioAttachment('https://media.discordapp.net/attachments/1/2/tone.mp3')).toBe(true);
	expect(isAudioAttachment('https://cdn.discordapp.com/attachments/1/2/clip.mp4?ex=1')).toBe(
		false,
	);
	expect(isAudioAttachment('https://example.com/a.ogg')).toBe(false);
});
