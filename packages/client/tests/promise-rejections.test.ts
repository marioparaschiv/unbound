import { describe, expect, spyOn, test } from 'bun:test';

import { stop, trackRejections } from '~/builtins/promise-rejections';

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
	test('logs every unhandled rejection', () => {
		const tracker = installHermes();

		trackRejections();

		expect(tracker()?.allRejections).toBe(true);
		expect(errorsLoggedBy(() => tracker()?.onUnhandled?.(4, new TypeError('probe')))).toContain(
			'Unhandled promise rejection 4:',
		);
	});

	test('stops logging once stopped', () => {
		const tracker = installHermes();

		trackRejections();
		stop();

		expect(errorsLoggedBy(() => tracker()?.onUnhandled?.(5, new Error('late')))).toBe('');
	});
});
