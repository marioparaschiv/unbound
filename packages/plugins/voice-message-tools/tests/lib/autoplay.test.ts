import { describe, expect, test } from 'bun:test';

import { nextVoiceMessage, playedToEnd } from '~/lib/autoplay';

const VOICE = 1 << 13;

describe('playedToEnd', () => {
	test('counts a voice message that reached its end', () => {
		expect(
			playedToEnd({ isVoiceMessage: true, endDurationSecs: 3.42, totalDurationSecs: 3.42 }),
		).toBe(true);
		expect(
			playedToEnd({ isVoiceMessage: true, endDurationSecs: 3.2, totalDurationSecs: 3.42 }),
		).toBe(true);
	});

	test('ignores pauses, other media and missing durations', () => {
		expect(
			playedToEnd({ isVoiceMessage: true, endDurationSecs: 1, totalDurationSecs: 3.42 }),
		).toBe(false);
		expect(
			playedToEnd({ isVoiceMessage: false, endDurationSecs: 3, totalDurationSecs: 3 }),
		).toBe(false);
		expect(playedToEnd({ isVoiceMessage: true })).toBe(false);
	});
});

describe('nextVoiceMessage', () => {
	const messages = [
		{ id: '1', flags: VOICE },
		{ id: '2', flags: 0 },
		{ id: '3', flags: VOICE | 1 },
		{ id: '4' },
	];

	test('skips other messages to the next voice message', () => {
		expect(nextVoiceMessage(messages, '1')).toBe('3');
	});

	test('stops after the last voice message or an unknown one', () => {
		expect(nextVoiceMessage(messages, '3')).toBeUndefined();
		expect(nextVoiceMessage(messages, '9')).toBeUndefined();
	});
});
