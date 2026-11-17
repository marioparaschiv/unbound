import { describe, expect, test } from 'bun:test';

import { formatTranscript, selectRange, spansDays, type TranscriptMessage } from '~/lib/transcript';

function message(
	id: string,
	author: string,
	at: string,
	content: string,
	attachments: string[] = [],
): TranscriptMessage {
	return { id, author, timestamp: new Date(at), content, attachments };
}

const day = [
	message('1', 'Ada', '2026-11-17T09:05:00', 'morning'),
	message('2', 'Bob', '2026-11-17T09:07:00', 'hi\nhow are you'),
	message('3', 'Ada', '2026-11-17T09:08:00', '', ['https://cdn.example/cat.png']),
];

describe('selectRange', () => {
	test('takes both ends inclusive, whichever was picked first', () => {
		expect(selectRange(day, '3', '2').map(({ id }) => id)).toEqual(['2', '3']);
		expect(selectRange(day, '1', '3').map(({ id }) => id)).toEqual(['1', '2', '3']);
	});

	test('returns nothing when an end is not loaded', () => {
		expect(selectRange(day, '1', '9')).toEqual([]);
	});
});

describe('formatTranscript', () => {
	test('writes time, author and text, indenting extra lines and listing attachments', () => {
		expect(formatTranscript(day, { dates: false })).toBe(
			[
				'[09:05] Ada: morning',
				'[09:07] Bob: hi',
				'    how are you',
				'[09:08] Ada: https://cdn.example/cat.png',
			].join('\n'),
		);
	});

	test('puts the date first when asked', () => {
		expect(formatTranscript(day.slice(0, 1), { dates: true })).toBe(
			'[2026-11-17 09:05] Ada: morning',
		);
	});
});

describe('spansDays', () => {
	test('notices a range crossing midnight', () => {
		expect(spansDays(day)).toBe(false);
		expect(spansDays([...day, message('4', 'Bob', '2026-11-18T00:01:00', 'late')])).toBe(true);
	});
});
