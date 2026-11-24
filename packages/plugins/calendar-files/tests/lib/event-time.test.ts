import { describe, expect, test } from 'bun:test';

import { eventTime } from '~/lib/event-time';

// ICU versions differ on the space before AM/PM.
const spaced = (text: string) => text.replace(/\s/g, ' ');

describe('eventTime', () => {
	test('gives only the end time when the event ends the same day', () => {
		const text = eventTime(new Date(2026, 11, 24, 19), new Date(2026, 11, 24, 21), 'en-US');

		expect(spaced(text)).toBe('Dec 24, 2026, 7:00 PM – 9:00 PM');
	});

	test('gives the end date when the event ends another day', () => {
		const text = eventTime(new Date(2026, 11, 24, 22), new Date(2026, 11, 25, 2), 'en-US');

		expect(spaced(text)).toBe('Dec 24, 2026, 10:00 PM – Dec 25, 2026, 2:00 AM');
	});

	test('leaves out seconds and the end when there is none', () => {
		expect(spaced(eventTime(new Date(2026, 11, 24, 19, 30, 15), undefined, 'en-US'))).toBe(
			'Dec 24, 2026, 7:30 PM',
		);
	});
});
