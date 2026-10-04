import { expect, test } from 'bun:test';

import createMomentCalendarLocale from './create-moment-calendar-locale';

test('uses the active Discord locale for existing localized calendar instances', () => {
	let activeLocale = 'en-US';
	const calls: unknown[][] = [];
	const moment = {
		locale(locale: string) {
			this.activeLocale = locale;
			return this;
		},
		activeLocale: 'ar',
		calendar(referenceTime?: Date) {
			calls.push([this.activeLocale, referenceTime]);
			return this.activeLocale;
		},
	};
	const wrapped = createMomentCalendarLocale(
		moment.calendar,
		() => activeLocale,
		() => ['en', 'en-us', 'de', 'de-de', 'ar'],
		moment.locale,
	);
	const referenceTime = new Date(0);

	expect(wrapped.call(moment, referenceTime)).toBe('en-us');

	activeLocale = 'de-DE';
	expect(wrapped.call(moment)).toBe('de-de');
	expect(calls).toEqual([
		['en-us', referenceTime],
		['de-de', undefined],
	]);
});
