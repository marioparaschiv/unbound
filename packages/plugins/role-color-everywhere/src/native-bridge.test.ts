import { expect, test } from 'bun:test';

import { getNativeObjC } from './native-bridge';

test('does not access the Objective-C bridge on Android', () => {
	const context = {
		platform: 'android',
		native: {
			get objc(): never {
				throw new Error('Objective-C is unavailable on Android');
			},
		},
	};

	expect(getNativeObjC(context)).toBeNull();
});

test('does not require the native context when unavailable', () => {
	expect(getNativeObjC()).toBeNull();
});
