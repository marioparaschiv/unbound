import { describe, expect, test } from 'bun:test';

import { buildCalendar, readStart } from '~/lib/event-file';
import { parseCalendar } from '~/lib/ics';

const INVITE = [
	'BEGIN:VCALENDAR',
	'BEGIN:VEVENT',
	'SUMMARY:Team sync\\, weekly',
	'DTSTART:20261124T150000Z',
	'DTEND:20261124T153000Z',
	'LOCATION:Room 4',
	'DESCRIPTION:Bring notes.\\nAnd snacks',
	'  for everyone',
	'END:VEVENT',
	'BEGIN:VEVENT',
	'SUMMARY:Holiday',
	'DTSTART;VALUE=DATE:20261225',
	'END:VEVENT',
	'END:VCALENDAR',
].join('\r\n');

describe('parseCalendar', () => {
	test('reads each event, unfolding and unescaping', () => {
		const [sync, holiday] = parseCalendar(INVITE);

		expect(sync).toEqual({
			summary: 'Team sync, weekly',
			start: new Date(Date.UTC(2026, 10, 24, 15)),
			end: new Date(Date.UTC(2026, 10, 24, 15, 30)),
			allDay: false,
			location: 'Room 4',
			description: 'Bring notes.\nAnd snacks for everyone',
		});
		expect(holiday).toEqual({
			summary: 'Holiday',
			start: new Date(2026, 11, 25),
			allDay: true,
		});
	});

	test('ignores text that is no calendar', () => {
		expect(parseCalendar('hello')).toEqual([]);
	});
});

describe('buildCalendar', () => {
	test('writes an event that reads back the same', () => {
		const start = new Date(Date.UTC(2026, 11, 24, 18, 30));
		const text = buildCalendar({
			title: 'Dinner; family',
			start,
			minutes: 90,
			location: 'Home',
			now: start,
		});
		const [event] = parseCalendar(text);

		expect(text).toContain('DTSTART:20261224T183000Z\r\n');
		expect(event).toEqual({
			summary: 'Dinner; family',
			start,
			end: new Date(Date.UTC(2026, 11, 24, 20)),
			allDay: false,
			location: 'Home',
		});
	});
});

describe('readStart', () => {
	test('reads a time today or an ISO date', () => {
		const now = new Date(2026, 10, 19, 9, 0);

		expect(readStart('18:30', now)).toEqual(new Date(2026, 10, 19, 18, 30));
		expect(readStart('2026-12-24 19:00', now)).toEqual(new Date(2026, 11, 24, 19, 0));
		expect(readStart('later', now)).toBeUndefined();
	});
});
