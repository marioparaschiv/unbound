import { describe, expect, test } from 'bun:test';

import { isCancellation } from './cancellation';

describe('isCancellation', () => {
	test('matches a disposed scope or cancelled async call', () => {
		const cancelled = Object.assign(new Error('Native async invocation was cancelled'), {
			code: 'NATIVE_PLUGIN_SCOPE_DISPOSED',
		});

		expect(isCancellation(cancelled)).toBe(true);
	});

	test('matches a Java view released mid-call', () => {
		const released = new Error(
			'java.lang.IllegalStateException: Java batch operation 1 failed: The Java handle is unavailable',
		);

		expect(isCancellation(released)).toBe(true);
	});

	test('keeps real failures', () => {
		expect(isCancellation(new Error('No such method'))).toBe(false);
		expect(isCancellation('cancelled')).toBe(false);
		expect(isCancellation(undefined)).toBe(false);
	});
});
