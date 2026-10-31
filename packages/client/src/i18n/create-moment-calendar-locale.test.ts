import { expect, test } from 'bun:test';

import createMomentCalendarLocale from './create-moment-calendar-locale';

type MomentInstance = {
	activeLocale: string;
};

test('uses the active Discord locale for existing localized calendar instances', () => {
	let activeLocale = 'en-US';
	const calls: unknown[][] = [];

	function locale(this: MomentInstance, value: string) {
		this.activeLocale = value;
	}

	function calendar(this: MomentInstance, referenceTime?: Date) {
		calls.push([this.activeLocale, referenceTime]);

		return this.activeLocale;
	}

	const moment: MomentInstance = { activeLocale: 'ar' };
	const wrapped = createMomentCalendarLocale(
		calendar,
		() => activeLocale,
		() => ['en', 'en-us', 'de', 'de-de', 'ar'],
		locale,
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
