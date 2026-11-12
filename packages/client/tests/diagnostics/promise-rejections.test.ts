import { describe, expect, mock, spyOn, test } from 'bun:test';

mock.module('react-native', () => ({
	AppState: { addEventListener: () => ({ remove: () => undefined }) },
}));

const { setRejectionTracker } = await import('~/diagnostics/promise-rejections');
const { default: diagnostics } = await import('~/diagnostics/builtin');

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

		setRejectionTracker();

		expect(tracker()?.allRejections).toBe(true);
		expect(errorsLoggedBy(() => tracker()?.onUnhandled?.(4, new TypeError('probe')))).toContain(
			'Unhandled promise rejection 4:',
		);
	});

	test('takes the tracker back from whoever replaced it', () => {
		const tracker = installHermes();

		setRejectionTracker();
		// Discord's startup installs its own tracker.
		(HermesInternal as HermesInternalObject).enablePromiseRejectionTracker?.({});
		diagnostics.start();

		expect(errorsLoggedBy(() => tracker()?.onUnhandled?.(6, new Error('late')))).toContain(
			'Unhandled promise rejection 6:',
		);
	});

	test('stops logging once stopped', () => {
		const tracker = installHermes();

		diagnostics.start();
		diagnostics.stop();

		expect(errorsLoggedBy(() => tracker()?.onUnhandled?.(7, new Error('late')))).toBe('');
	});

	test('does nothing without Hermes', () => {
		(globalThis as { HermesInternal?: unknown }).HermesInternal = null;

		expect(() => setRejectionTracker()).not.toThrow();
	});
});
