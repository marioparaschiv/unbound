import { describe, expect, test } from 'bun:test';

import { previewTimestamp, relativeTime } from '~/lib/preview';

const moment = new Date(Date.UTC(2026, 11, 24, 18, 5, 9));
const format = { locale: 'en-GB', timeZone: 'UTC' };

describe('timestamp previews', () => {
	test('draws each date and time style the way Discord does', () => {
		expect(previewTimestamp(moment, 't', moment, format)).toBe('18:05');
		expect(previewTimestamp(moment, 'T', moment, format)).toBe('18:05:09');
		expect(previewTimestamp(moment, 'd', moment, format)).toBe('24/12/2026');
		expect(previewTimestamp(moment, 'D', moment, format)).toBe('24 December 2026');
		expect(previewTimestamp(moment, 'f', moment, format)).toBe('24 December 2026 at 18:05');
		expect(previewTimestamp(moment, 'F', moment, format)).toBe(
			'Thursday, 24 December 2026 at 18:05',
		);
	});

	test('draws the relative style from now, in the largest whole unit', () => {
		const now = new Date(moment.getTime() - 2 * 60 * 60 * 1000);

		expect(previewTimestamp(moment, 'R', now, format)).toBe('in 2 hours');
		expect(relativeTime(-3 * 24 * 60 * 60, 'en-GB')).toBe('3 days ago');
		expect(relativeTime(45, 'en-GB')).toBe('in 45 seconds');
		expect(relativeTime(400 * 24 * 60 * 60, 'en-GB')).toBe('in 1 year');
	});
});
