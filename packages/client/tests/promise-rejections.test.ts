import { describe, expect, spyOn, test } from 'bun:test';

import { trackPromiseRejections } from '~/diagnostics/promise-rejections';

function installHermes() {
	let options: PromiseRejectionTrackerOptions | undefined;

	// React Native declares `HermesInternal` as a read-only global.
	(globalThis as { HermesInternal?: HermesInternalObject }).HermesInternal = {
		getRuntimeProperties: () => ({}),
		enablePromiseRejectionTracker(next: PromiseRejectionTrackerOptions) {
			options = next;
		},
	};

	return () => options;
}

function errorsLoggedBy(reject: () => void): string {
	const spy = spyOn(console, 'error').mockImplementation(() => {});

	try {
		reject();

		return spy.mock.calls.flat().join(' ');
	} finally {
		spy.mockRestore();
	}
}

describe('promise rejections', () => {
	test('logs every unhandled rejection the tracker reports', () => {
		const tracker = installHermes();

		trackPromiseRejections();

		expect(tracker()?.allRejections).toBe(true);
		expect(errorsLoggedBy(() => tracker()?.onUnhandled?.(4, new TypeError('probe')))).toContain(
			'Unhandled promise rejection 4:',
		);
	});

	test('does nothing without Hermes', () => {
		(globalThis as { HermesInternal?: unknown }).HermesInternal = null;

		expect(() => trackPromiseRejections()).not.toThrow();
	});
});
