import { expect, mock, test } from 'bun:test';

const NativeModules: Record<string, unknown> = {};

mock.module('react-native', () => ({ NativeModules }));

const { deviceLocale } = await import('~/locale/android/device-locale');

test('reads the locale from the TurboModule constants when the property is missing', () => {
	NativeModules.I18nManager = { getConstants: () => ({ localeIdentifier: 'en_AU' }) };

	expect(deviceLocale()).toBe('en_AU');
});

test('prefers the legacy property and survives a missing module', () => {
	NativeModules.I18nManager = {
		localeIdentifier: 'en_GB',
		getConstants: () => ({ localeIdentifier: 'en_AU' }),
	};

	expect(deviceLocale()).toBe('en_GB');

	delete NativeModules.I18nManager;

	expect(deviceLocale()).toBeUndefined();
});
