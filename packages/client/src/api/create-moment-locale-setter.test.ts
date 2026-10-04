import { expect, test } from 'bun:test';

import createMomentLocaleSetter from './create-moment-locale-setter';

test('maps future locale writes to the active Discord locale', () => {
	let activeLocale = 'en-US';
	let momentLocale = 'hi';
	const setLocale = createMomentLocaleSetter(
		(locale: string) => (momentLocale = locale),
		() => activeLocale,
		() => ['en', 'en-us', 'de', 'de-de', 'hi'],
	);

	setLocale('hi');

	expect(momentLocale).toBe('en-us');

	activeLocale = 'de-DE';
	setLocale('hi');

	expect(momentLocale).toBe('de-de');
});

test('passes locale reads and non-string calls through unchanged', () => {
	const calls: unknown[][] = [];
	function setLocale(...args: unknown[]) {
		calls.push(args);
		return args[0] ?? 'current';
	}
	const wrapped = createMomentLocaleSetter(
		setLocale,
		() => 'en-US',
		() => ['en'],
	);

	expect(wrapped()).toBe('current');
	expect(wrapped(undefined)).toBe('current');
	expect(calls).toEqual([[], [undefined]]);
});

test('maps instance locale overrides to the active Discord locale', () => {
	let activeLocale = 'en-US';
	const calls: string[] = [];
	const instance = {
		locale(locale: string) {
			calls.push(locale);
			return this;
		},
	};
	const wrapped = createMomentLocaleSetter(
		instance.locale,
		() => activeLocale,
		() => ['en', 'en-us', 'de', 'de-de', 'ar'],
	);

	wrapped.call(instance, 'ar');
	activeLocale = 'de-DE';
	wrapped.call(instance, 'ar');

	expect(calls).toEqual(['en-us', 'de-de']);
});

test('maps locale preference lists to the active Discord locale', () => {
	let momentLocale = 'ar';
	const setLocale = createMomentLocaleSetter(
		(locale: string | string[]) => (momentLocale = Array.isArray(locale) ? locale[0] : locale),
		() => 'de-DE',
		() => ['en', 'en-us', 'de', 'de-de', 'ar'],
	);

	setLocale(['ar', 'en']);

	expect(momentLocale).toBe('de-de');
});
