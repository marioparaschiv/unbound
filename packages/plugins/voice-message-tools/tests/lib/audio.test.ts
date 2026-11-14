import { describe, expect, test } from 'bun:test';

import {
	FLAT_WAVEFORM,
	showAsVoiceMessage,
	voiceMessageFlags,
	type PendingUpload,
	type ReceivedMessage,
} from '~/lib/audio';

describe('sending audio as a voice message', () => {
	test('marks a message of only audio files', () => {
		const uploads: PendingUpload[] = [{ mimeType: 'audio/mpeg' }];

		expect(voiceMessageFlags('', uploads)).toBe(8192);
		expect(uploads[0]).toEqual({
			mimeType: 'audio/ogg',
			durationSecs: 60,
			waveform: FLAT_WAVEFORM,
		});
	});

	test('leaves text, mixed files and nothing alone', () => {
		expect(voiceMessageFlags('hi', [{ mimeType: 'audio/mpeg' }])).toBeUndefined();
		expect(
			voiceMessageFlags('', [{ mimeType: 'audio/mpeg' }, { mimeType: 'image/png' }]),
		).toBeUndefined();
		expect(voiceMessageFlags('', [])).toBeUndefined();
	});
});

describe('showing audio as a voice message', () => {
	test('flags a message whose first file is audio', () => {
		const message: ReceivedMessage = {
			flags: 0,
			attachments: [{ content_type: 'audio/mpeg' }],
		};

		expect(showAsVoiceMessage(message)).toBe(true);
		expect(message.flags).toBe(8192);
		expect(message.attachments![0]!.waveform).toBe(FLAT_WAVEFORM);
	});

	test('leaves voice messages and other files alone', () => {
		expect(
			showAsVoiceMessage({ flags: 8192, attachments: [{ content_type: 'audio/ogg' }] }),
		).toBe(false);
		expect(showAsVoiceMessage({ attachments: [{ content_type: 'image/png' }] })).toBe(false);
	});
});
