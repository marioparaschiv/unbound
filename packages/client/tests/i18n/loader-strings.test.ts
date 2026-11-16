import { describe, expect, test } from 'bun:test';

import { pickLoaderStrings } from '~/i18n/loader-strings';

describe('pickLoaderStrings', () => {
	const fallback = {
		UNBOUND_CLIENT: 'Unbound',
		UNBOUND_NATIVE_CLOSE: 'Close',
		UNBOUND_NATIVE_CANCEL: 'Cancel',
	};

	test('keeps only loader keys, translated where the locale has them', () => {
		expect(
			pickLoaderStrings({ UNBOUND_NATIVE_CLOSE: 'Schließen', UNBOUND_CLIENT: 'x' }, fallback),
		).toEqual({ UNBOUND_NATIVE_CLOSE: 'Schließen', UNBOUND_NATIVE_CANCEL: 'Cancel' });
	});

	test('uses English for empty translations and before the locale loads', () => {
		expect(pickLoaderStrings({ UNBOUND_NATIVE_CLOSE: '' }, fallback)).toEqual({
			UNBOUND_NATIVE_CLOSE: 'Close',
			UNBOUND_NATIVE_CANCEL: 'Cancel',
		});
		expect(pickLoaderStrings(undefined, fallback)).toEqual({
			UNBOUND_NATIVE_CLOSE: 'Close',
			UNBOUND_NATIVE_CANCEL: 'Cancel',
		});
	});
});
