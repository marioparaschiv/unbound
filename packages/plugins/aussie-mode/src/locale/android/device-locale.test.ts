import { expect, mock, test } from 'bun:test';

mock.module('react-native', () => ({ NativeModules: {}, View: 'View' }));

const { deviceLocale } = await import('~/locale/android/device-locale');

test('reads the locale from the TurboModule constants when the property is missing', () => {
	expect(
		deviceLocale({ I18nManager: { getConstants: () => ({ localeIdentifier: 'en_AU' }) } }),
	).toBe('en_AU');
});

test('prefers the legacy property and survives a missing module', () => {
	expect(
		deviceLocale({
			I18nManager: {
				localeIdentifier: 'en_GB',
				getConstants: () => ({ localeIdentifier: 'en_AU' }),
			},
		}),
	).toBe('en_GB');
	expect(deviceLocale({})).toBeUndefined();
});
